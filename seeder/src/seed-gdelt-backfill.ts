import { createHash, randomUUID } from "crypto";
import axios from "axios";
import { Pool, PoolClient } from "pg";
import {
  MACRO_EXCHANGES,
  MACRO_ROUTING_KEYS,
  MacroRawArticle,
  RabbitMQService,
} from "@financialsignalsgatheringsystem/common";

const DB_CONFIG = {
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "market_signals",
  password: process.env.DB_PASSWORD || "postgres",
  port: parseInt(process.env.DB_PORT || "5432", 10),
};

const GDELT_API_URL =
  process.env.GDELT_API_URL || "https://api.gdeltproject.org/api/v2/doc/doc";
const DEFAULT_QUERY =
  '("strait of hormuz" OR opec OR sanctions OR "federal reserve" OR "central bank" OR inflation OR "oil supply" OR "brent crude")';
const GDELT_BACKFILL_QUERY = process.env.GDELT_BACKFILL_QUERY || DEFAULT_QUERY;
const GDELT_BACKFILL_WINDOW_HOURS = parseInt(
  process.env.GDELT_BACKFILL_WINDOW_HOURS || "24",
  10,
);
const GDELT_BACKFILL_MAX_RECORDS = parseInt(
  process.env.GDELT_BACKFILL_MAX_RECORDS || "250",
  10,
);
const GDELT_BACKFILL_DELAY_MS = parseInt(
  process.env.GDELT_BACKFILL_DELAY_MS || "1000",
  10,
);
const GDELT_BACKFILL_START =
  process.env.GDELT_BACKFILL_START ||
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const GDELT_BACKFILL_END =
  process.env.GDELT_BACKFILL_END || new Date().toISOString();

const RABBITMQ_URL = process.env.RABBITMQ_URL || "";
const GDELT_PUBLISH_TO_QUEUE =
  (
    process.env.GDELT_PUBLISH_TO_QUEUE || (RABBITMQ_URL ? "true" : "false")
  ).toLowerCase() === "true";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  themes?: string;
  tone?: string;
  [k: string]: unknown;
};

type GdeltDocResponse = {
  articles?: GdeltArticle[];
};

type PersistResult = {
  id: string;
  inserted: boolean;
};

type SeedStats = {
  windows: number;
  fetched: number;
  localDeduped: number;
  dbDeduped: number;
  inserted: number;
  published: number;
};

class BackfillDedupeTracker {
  private readonly externalIds = new Set<string>();
  private readonly contentHashes = new Set<string>();

  public has(externalId: string, contentHash: string): boolean {
    return (
      this.externalIds.has(externalId) || this.contentHashes.has(contentHash)
    );
  }

  public remember(externalId: string, contentHash: string): void {
    this.externalIds.add(externalId);
    this.contentHashes.add(contentHash);
  }
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function toGdeltDateTime(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const second = date.getUTCSeconds().toString().padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function parseFlexibleDate(raw: string): Date {
  const normalized = raw.trim();
  if (/^\d{14}$/.test(normalized)) {
    const y = normalized.slice(0, 4);
    const mo = normalized.slice(4, 6);
    const d = normalized.slice(6, 8);
    const h = normalized.slice(8, 10);
    const mi = normalized.slice(10, 12);
    const s = normalized.slice(12, 14);
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`);
  }
  return new Date(normalized);
}

function parseGdeltSeenDate(raw?: string): Date | undefined {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.replace(/[^\d]/g, "");
  if (normalized.length >= 14) {
    const value = normalized.slice(0, 14);
    return parseFlexibleDate(value);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function buildExternalId(url: string): string {
  return `gdelt:${createHash("sha1").update(url.toLowerCase()).digest("hex")}`;
}

function buildContentHash(
  url: string,
  title: string,
  publishedAt?: Date,
): string {
  return createHash("sha256")
    .update(
      `${url.toLowerCase()}|${title.toLowerCase()}|${publishedAt?.toISOString() || ""}`,
    )
    .digest("hex");
}

function mapArticleToRaw(article: GdeltArticle): MacroRawArticle | null {
  const rawUrl = typeof article.url === "string" ? article.url.trim() : "";
  if (!rawUrl) {
    return null;
  }

  const title =
    typeof article.title === "string" && article.title.trim()
      ? normalizeWhitespace(article.title)
      : rawUrl;
  const publishedAt = parseGdeltSeenDate(
    typeof article.seendate === "string" ? article.seendate : undefined,
  );
  const externalId = buildExternalId(rawUrl);
  const contentHash = buildContentHash(rawUrl, title, publishedAt);

  const metadata: Record<string, unknown> = {
    domain: article.domain || null,
    language: article.language || null,
    source_country: article.sourcecountry || null,
    themes: article.themes || null,
    tone: article.tone || null,
    gdelt: article,
  };

  return {
    id: randomUUID(),
    source: "GDELT",
    external_id: externalId,
    url: rawUrl,
    title,
    body: undefined,
    language: typeof article.language === "string" ? article.language : "en",
    published_at: publishedAt,
    fetched_at: new Date(),
    content_hash: contentHash,
    metadata,
  };
}

async function fetchGdeltWindow(
  start: Date,
  end: Date,
): Promise<GdeltArticle[]> {
  const response = await axios.get<GdeltDocResponse | string>(GDELT_API_URL, {
    params: {
      query: GDELT_BACKFILL_QUERY,
      mode: "ArtList",
      format: "json",
      maxrecords: GDELT_BACKFILL_MAX_RECORDS,
      sort: "DateAsc",
      startdatetime: toGdeltDateTime(start),
      enddatetime: toGdeltDateTime(end),
    },
    timeout: 30000,
  });

  if (typeof response.data === "string") {
    return [];
  }

  return Array.isArray(response.data.articles) ? response.data.articles : [];
}

async function persistRawArticle(
  client: PoolClient,
  article: MacroRawArticle,
): Promise<PersistResult> {
  const insertQuery = `
		INSERT INTO public.macro_raw_articles (
			id, source, external_id, url, title, body, language, published_at, fetched_at, content_hash, metadata
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT DO NOTHING
		RETURNING id;
	`;

  const insertValues = [
    article.id,
    article.source,
    article.external_id || null,
    article.url || null,
    article.title || null,
    article.body || null,
    article.language || "en",
    article.published_at || null,
    article.fetched_at,
    article.content_hash,
    article.metadata || {},
  ];

  const insertResult = await client.query<{ id: string }>(
    insertQuery,
    insertValues,
  );
  if (insertResult.rows.length > 0) {
    return { id: insertResult.rows[0].id, inserted: true };
  }

  const selectResult = await client.query<{ id: string }>(
    `
			SELECT id
			FROM public.macro_raw_articles
			WHERE content_hash = $1
			   OR ($3 IS NOT NULL AND source = $2 AND external_id = $3)
			ORDER BY fetched_at DESC
			LIMIT 1;
		`,
    [article.content_hash, article.source, article.external_id || null],
  );

  if (selectResult.rows.length === 0) {
    throw new Error(
      "Unable to resolve existing macro_raw_articles row after conflict.",
    );
  }

  return { id: selectResult.rows[0].id, inserted: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishRawArticle(
  broker: RabbitMQService,
  article: MacroRawArticle,
): Promise<void> {
  await broker.publish(
    MACRO_EXCHANGES.RAW,
    MACRO_ROUTING_KEYS.RAW_ARTICLE,
    article,
    {
      exchange: {
        type: "topic",
      },
    },
  );
}

async function run(): Promise<void> {
  console.log(
    "--- [GDELTBackfillSeeder] Starting GDELT backfill + dedupe ingestion ---",
  );
  const start = parseFlexibleDate(GDELT_BACKFILL_START);
  const end = parseFlexibleDate(GDELT_BACKFILL_END);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid GDELT_BACKFILL_START or GDELT_BACKFILL_END date.");
  }
  if (start >= end) {
    throw new Error("GDELT backfill start date must be before end date.");
  }

  const pool = new Pool(DB_CONFIG);
  const client = await pool.connect();

  let broker: RabbitMQService | undefined;
  const shouldPublish = GDELT_PUBLISH_TO_QUEUE && Boolean(RABBITMQ_URL);
  if (shouldPublish) {
    broker = new RabbitMQService(RABBITMQ_URL);
    await broker.connect();
  } else if (GDELT_PUBLISH_TO_QUEUE && !RABBITMQ_URL) {
    console.warn(
      "[GDELTBackfillSeeder] GDELT_PUBLISH_TO_QUEUE=true but RABBITMQ_URL missing, publishing disabled.",
    );
  }

  const dedupeTracker = new BackfillDedupeTracker();
  const stats: SeedStats = {
    windows: 0,
    fetched: 0,
    localDeduped: 0,
    dbDeduped: 0,
    inserted: 0,
    published: 0,
  };

  try {
    let cursor = new Date(start);
    const windowMs = Math.max(1, GDELT_BACKFILL_WINDOW_HOURS) * 60 * 60 * 1000;

    while (cursor < end) {
      const windowEnd = new Date(
        Math.min(cursor.getTime() + windowMs, end.getTime()),
      );
      stats.windows += 1;

      console.log(
        `[GDELTBackfillSeeder] Fetching window ${toGdeltDateTime(cursor)} -> ${toGdeltDateTime(windowEnd)}`,
      );
      const articles = await fetchGdeltWindow(cursor, windowEnd);
      stats.fetched += articles.length;

      for (const article of articles) {
        const raw = mapArticleToRaw(article);
        if (!raw || !raw.external_id) {
          continue;
        }

        if (dedupeTracker.has(raw.external_id, raw.content_hash)) {
          stats.localDeduped += 1;
          continue;
        }
        dedupeTracker.remember(raw.external_id, raw.content_hash);

        const persisted = await persistRawArticle(client, raw);
        if (!persisted.inserted) {
          stats.dbDeduped += 1;
          continue;
        }
        stats.inserted += 1;

        if (broker) {
          await publishRawArticle(broker, { ...raw, id: persisted.id });
          stats.published += 1;
        }
      }

      cursor = windowEnd;
      if (GDELT_BACKFILL_DELAY_MS > 0) {
        await sleep(GDELT_BACKFILL_DELAY_MS);
      }
    }

    console.log(
      `[GDELTBackfillSeeder] Done windows=${stats.windows} fetched=${stats.fetched} inserted=${stats.inserted} local_deduped=${stats.localDeduped} db_deduped=${stats.dbDeduped} published=${stats.published}`,
    );
  } finally {
    if (broker) {
      await broker.close();
    }
    client.release();
    await pool.end();
  }
}

run()
  .catch((error) => {
    console.error("[GDELTBackfillSeeder] Failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
