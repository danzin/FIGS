import { Pool } from "pg";
import {
  Errors,
  MacroEvent,
  MacroRawArticle,
  isAppError,
} from "@financialsignalsgatheringsystem/common";

interface DbConfig {
  host?: string;
  port: number;
  user?: string;
  password?: string;
  database?: string;
}

export class EventPersister {
  private pool: Pool;

  constructor(dbConfig: DbConfig) {
    this.pool = new Pool(dbConfig);
  }

  public async connect(): Promise<void> {
    try {
      await this.pool.query("SELECT 1");
    } catch (error) {
      throw Errors.database("Failed to connect to macro event database.", {
        cause: error,
        context: {
          operation: "connect",
          service: "macro-event-extractor-service",
        },
      });
    }
  }

  public async close(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      throw Errors.database(
        "Failed to close macro event database connection.",
        {
          cause: error,
          context: {
            operation: "close",
            service: "macro-event-extractor-service",
          },
        },
      );
    }
  }

  public async saveRawArticle(article: MacroRawArticle): Promise<string> {
    try {
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

      const insertRes = await this.pool.query<{ id: string }>(
        insertQuery,
        insertValues,
      );
      if (insertRes.rows.length > 0) {
        return insertRes.rows[0].id;
      }

      const selectQuery = `
			SELECT id
			FROM public.macro_raw_articles
			WHERE content_hash = $1
			   OR ($3 IS NOT NULL AND source = $2 AND external_id = $3)
			ORDER BY fetched_at DESC
			LIMIT 1;
		`;

      const selectRes = await this.pool.query<{ id: string }>(selectQuery, [
        article.content_hash,
        article.source,
        article.external_id || null,
      ]);

      if (selectRes.rows.length === 0) {
        throw Errors.database(
          "Failed to resolve macro_raw_articles id after insert.",
          {
            context: {
              operation: "saveRawArticle",
              contentHash: article.content_hash,
              source: article.source,
              service: "macro-event-extractor-service",
            },
          },
        );
      }

      return selectRes.rows[0].id;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      throw Errors.database("Failed to persist macro raw article.", {
        cause: error,
        context: {
          operation: "saveRawArticle",
          contentHash: article.content_hash,
          source: article.source,
          service: "macro-event-extractor-service",
        },
      });
    }
  }

  public async saveMacroEvent(event: MacroEvent): Promise<void> {
    try {
      const query = `
			INSERT INTO public.macro_events (
				id, raw_article_id, event_time, event_type, channel, severity, region, country_codes,
				affected_assets, canonical_text, extraction_model, extraction_version, confidence, metadata
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
			ON CONFLICT (id) DO NOTHING;
		`;

      await this.pool.query(query, [
        event.id,
        event.raw_article_id || null,
        event.event_time,
        event.event_type,
        event.channel,
        event.severity,
        event.region || null,
        event.country_codes || [],
        event.affected_assets || [],
        event.canonical_text,
        event.extraction_model,
        event.extraction_version,
        event.confidence,
        event.metadata || {},
      ]);
    } catch (error) {
      throw Errors.database("Failed to persist macro event.", {
        cause: error,
        context: {
          operation: "saveMacroEvent",
          eventId: event.id,
          eventType: event.event_type,
          service: "macro-event-extractor-service",
        },
      });
    }
  }
}
