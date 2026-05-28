import { createHash, randomUUID } from "crypto";
import { Pool, PoolClient } from "pg";
import axios from "axios";
import { IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

const DB_CONFIG = {
	user: process.env.DB_USER || "postgres",
	host: process.env.DB_HOST || "localhost",
	database: process.env.DB_NAME || "market_signals",
	password: process.env.DB_PASSWORD || "postgres",
	port: parseInt(process.env.DB_PORT || "5432", 10),
};

const FRED_API_KEY = process.env.FRED_API_KEY || "";
const MACRO_HISTORY_START_DATE = process.env.MACRO_HISTORY_START_DATE || "2008-01-01";
const MACRO_HISTORY_END_DATE = process.env.MACRO_HISTORY_END_DATE || new Date().toISOString().slice(0, 10);
const BATCH_SIZE = 500;

type FredSeriesSeed = {
	seriesId: string;
	indicatorName: string;
	source: string;
};

type CuratedMacroEventSeed = {
	externalId: string;
	title: string;
	canonicalText: string;
	eventTime: string;
	eventType: string;
	channel: string;
	severity: number;
	region: string;
	countryCodes: string[];
	affectedAssets: string[];
	referenceUrl: string;
};

const FRED_SERIES: FredSeriesSeed[] = [
	{ seriesId: "DCOILBRENTEU", indicatorName: "brent_crude_oil_price", source: "FRED-History-Seed" },
	{ seriesId: "FEDFUNDS", indicatorName: "FRED_FEDFUNDS", source: "FRED-History-Seed" },
	{ seriesId: "DGS10", indicatorName: "FRED_DGS10", source: "FRED-History-Seed" },
	{ seriesId: "CPIAUCSL", indicatorName: "FRED_CPIAUCSL", source: "FRED-History-Seed" },
	{ seriesId: "M2SL", indicatorName: "FRED_M2SL", source: "FRED-History-Seed" },
	{ seriesId: "RRPONTSYD", indicatorName: "FRED_RRPONTSYD", source: "FRED-History-Seed" },
	{ seriesId: "UNRATE", indicatorName: "FRED_UNRATE", source: "FRED-History-Seed" },
	{ seriesId: "DTWEXBGS", indicatorName: "FRED_DTWEXBGS", source: "FRED-History-Seed" },
];

const CURATED_MACRO_EVENTS: CuratedMacroEventSeed[] = [
	{
		externalId: "gulf-war-oil-shock-1990",
		title: "Iraq invades Kuwait, triggering Gulf oil supply shock",
		canonicalText:
			"Iraq's invasion of Kuwait sharply increased geopolitical risk in the Gulf and triggered an oil supply shock with global inflation and policy implications.",
		eventTime: "1990-08-02T00:00:00.000Z",
		eventType: "oil_supply_shock",
		channel: "energy",
		severity: 0.95,
		region: "Middle East",
		countryCodes: ["IRQ", "KWT"],
		affectedAssets: ["brent", "wti", "dxy", "us10y", "btc"],
		referenceUrl: "https://en.wikipedia.org/wiki/Gulf_War",
	},
	{
		externalId: "iraq-war-energy-risk-2003",
		title: "US-led invasion of Iraq raises Middle East supply risk",
		canonicalText:
			"The 2003 Iraq conflict elevated sustained energy supply risk premia and macro uncertainty across commodities and global risk assets.",
		eventTime: "2003-03-20T00:00:00.000Z",
		eventType: "geopolitical_risk_event",
		channel: "sanctions_and_geopolitics",
		severity: 0.82,
		region: "Middle East",
		countryCodes: ["IRQ", "USA"],
		affectedAssets: ["brent", "dxy", "us10y", "btc"],
		referenceUrl: "https://en.wikipedia.org/wiki/Iraq_War",
	},
	{
		externalId: "gfc-policy-easing-2008",
		title: "Global financial crisis forces emergency policy easing",
		canonicalText:
			"The global financial crisis triggered emergency liquidity interventions and large policy regime changes by major central banks.",
		eventTime: "2008-09-15T00:00:00.000Z",
		eventType: "policy_easing",
		channel: "monetary_policy",
		severity: 0.93,
		region: "Global",
		countryCodes: ["USA"],
		affectedAssets: ["dxy", "us10y", "btc", "eth"],
		referenceUrl: "https://en.wikipedia.org/wiki/Financial_crisis_of_2007%E2%80%932008",
	},
	{
		externalId: "libya-civil-war-oil-2011",
		title: "Libya conflict disrupts Mediterranean oil exports",
		canonicalText:
			"The Libya conflict removed part of global crude supply, raising energy price pressure and global macro uncertainty.",
		eventTime: "2011-02-20T00:00:00.000Z",
		eventType: "oil_supply_shock",
		channel: "energy",
		severity: 0.78,
		region: "Middle East and North Africa",
		countryCodes: ["LBY"],
		affectedAssets: ["brent", "wti", "dxy", "btc"],
		referenceUrl: "https://en.wikipedia.org/wiki/First_Libyan_Civil_War",
	},
	{
		externalId: "crimea-sanctions-2014",
		title: "Crimea annexation leads to sanctions escalation",
		canonicalText:
			"Russia's annexation of Crimea triggered a sanctions cycle and elevated geopolitical risk with knock-on effects for commodities and rates.",
		eventTime: "2014-03-18T00:00:00.000Z",
		eventType: "sanctions_update",
		channel: "sanctions_and_geopolitics",
		severity: 0.74,
		region: "Eastern Europe",
		countryCodes: ["RUS", "UKR"],
		affectedAssets: ["brent", "dxy", "btc"],
		referenceUrl: "https://en.wikipedia.org/wiki/Annexation_of_Crimea_by_the_Russian_Federation",
	},
	{
		externalId: "opec-production-cuts-2016",
		title: "OPEC agrees coordinated production cuts",
		canonicalText:
			"OPEC production coordination shifted expected crude balances and reset inflation expectations through higher oil prices.",
		eventTime: "2016-11-30T00:00:00.000Z",
		eventType: "oil_production_decision",
		channel: "energy",
		severity: 0.66,
		region: "Global",
		countryCodes: ["SAU"],
		affectedAssets: ["brent", "wti", "btc"],
		referenceUrl: "https://en.wikipedia.org/wiki/OPEC",
	},
	{
		externalId: "gulf-oman-tanker-attacks-2019",
		title: "Gulf of Oman tanker attacks elevate Strait of Hormuz risk",
		canonicalText:
			"Tanker incidents near Hormuz increased shipping risk premia and highlighted potential disruption to global energy transit.",
		eventTime: "2019-06-13T00:00:00.000Z",
		eventType: "shipping_disruption",
		channel: "energy",
		severity: 0.77,
		region: "Middle East",
		countryCodes: ["OMN", "IRN"],
		affectedAssets: ["brent", "wti", "dxy", "btc"],
		referenceUrl: "https://en.wikipedia.org/wiki/Gulf_of_Oman_incident",
	},
	{
		externalId: "covid-oil-demand-collapse-2020",
		title: "COVID demand collapse and oil market shock",
		canonicalText:
			"The pandemic caused an abrupt oil demand collapse and emergency policy interventions, producing an extreme macro regime shift.",
		eventTime: "2020-03-20T00:00:00.000Z",
		eventType: "oil_supply_shock",
		channel: "energy",
		severity: 0.97,
		region: "Global",
		countryCodes: ["USA", "CHN"],
		affectedAssets: ["brent", "wti", "dxy", "btc", "eth"],
		referenceUrl: "https://en.wikipedia.org/wiki/COVID-19_recession",
	},
	{
		externalId: "fed-taper-signal-2021",
		title: "Fed signals taper and tighter future policy path",
		canonicalText:
			"Federal Reserve guidance shifted toward tapering and eventual tightening, repricing liquidity-sensitive assets globally.",
		eventTime: "2021-11-03T00:00:00.000Z",
		eventType: "policy_tightening",
		channel: "monetary_policy",
		severity: 0.7,
		region: "United States",
		countryCodes: ["USA"],
		affectedAssets: ["dxy", "us10y", "btc", "eth"],
		referenceUrl: "https://www.federalreserve.gov/monetarypolicy.htm",
	},
	{
		externalId: "russia-ukraine-invasion-2022",
		title: "Russia invades Ukraine, triggering sanctions and energy shock",
		canonicalText:
			"The 2022 invasion drove a major sanctions cycle and commodity shock, increasing inflation pressure and policy tightening risks.",
		eventTime: "2022-02-24T00:00:00.000Z",
		eventType: "sanctions_update",
		channel: "sanctions_and_geopolitics",
		severity: 0.96,
		region: "Eastern Europe",
		countryCodes: ["RUS", "UKR"],
		affectedAssets: ["brent", "wti", "dxy", "us10y", "btc", "eth"],
		referenceUrl: "https://en.wikipedia.org/wiki/Russian_invasion_of_Ukraine",
	},
	{
		externalId: "us-regional-bank-stress-2023",
		title: "US regional bank stress alters policy and liquidity expectations",
		canonicalText:
			"US regional banking stress shifted policy expectations and liquidity risk pricing across rates, equities, and crypto assets.",
		eventTime: "2023-03-10T00:00:00.000Z",
		eventType: "financial_stability_risk",
		channel: "monetary_policy",
		severity: 0.73,
		region: "United States",
		countryCodes: ["USA"],
		affectedAssets: ["dxy", "us10y", "btc", "eth"],
		referenceUrl: "https://www.federalreserve.gov/newsevents.htm",
	},
	{
		externalId: "red-sea-shipping-disruptions-2024",
		title: "Red Sea attacks disrupt shipping routes and freight costs",
		canonicalText:
			"Persistent Red Sea shipping attacks disrupted logistics channels, adding energy transport frictions and inflationary pressure risk.",
		eventTime: "2024-01-15T00:00:00.000Z",
		eventType: "shipping_disruption",
		channel: "energy",
		severity: 0.79,
		region: "Middle East",
		countryCodes: ["YEM"],
		affectedAssets: ["brent", "wti", "dxy", "btc"],
		referenceUrl: "https://en.wikipedia.org/wiki/Red_Sea_crisis",
	},
];

function buildContentHash(parts: string[]): string {
	return createHash("sha256").update(parts.join("|")).digest("hex");
}

async function insertIndicatorBatch(client: PoolClient, points: IndicatorDataPoint[]): Promise<void> {
	if (points.length === 0) {
		return;
	}

	const query = `
		INSERT INTO public.market_indicators (time, name, value, source)
		SELECT * FROM UNNEST(
			$1::TIMESTAMPTZ[],
			$2::TEXT[],
			$3::DOUBLE PRECISION[],
			$4::TEXT[]
		);
	`;

	const values = points.reduce(
		(acc, point) => {
			acc[0].push(point.time);
			acc[1].push(point.name);
			acc[2].push(point.value ?? null);
			acc[3].push(point.source);
			return acc;
		},
		[[], [], [], []] as [Date[], string[], (number | null)[], string[]]
	);

	await client.query(query, values);
}

async function hasHistoricalSeries(client: PoolClient, indicatorName: string): Promise<boolean> {
	const result = await client.query<{ count: string }>(
		`
			SELECT COUNT(*)::TEXT AS count
			FROM public.market_indicators
			WHERE name = $1
			  AND source = 'FRED-History-Seed';
		`,
		[indicatorName]
	);

	return Number(result.rows[0]?.count ?? "0") > 0;
}

type FredObservation = {
	date: string;
	value: string;
};

type FredObservationResponse = {
	observations?: FredObservation[];
};

async function fetchFredSeriesHistory(series: FredSeriesSeed): Promise<IndicatorDataPoint[]> {
	const response = await axios.get<FredObservationResponse>(
		"https://api.stlouisfed.org/fred/series/observations",
		{
			params: {
				series_id: series.seriesId,
				api_key: FRED_API_KEY,
				file_type: "json",
				observation_start: MACRO_HISTORY_START_DATE,
				observation_end: MACRO_HISTORY_END_DATE,
				sort_order: "asc",
				limit: 100000,
			},
			timeout: 30000,
		}
	);

	const observations = response.data.observations || [];
	const points: IndicatorDataPoint[] = [];

	for (const item of observations) {
		if (!item?.date || item.value === ".") {
			continue;
		}

		const numeric = Number(item.value);
		const timestamp = new Date(item.date);

		if (Number.isNaN(numeric) || Number.isNaN(timestamp.getTime())) {
			continue;
		}

		points.push({
			name: series.indicatorName,
			time: timestamp,
			value: numeric,
			source: series.source,
		});
	}

	return points;
}

async function seedFredHistory(client: PoolClient): Promise<void> {
	if (!FRED_API_KEY) {
		console.warn("[MacroHistorySeeder] FRED_API_KEY missing. Skipping FRED historical backfill.");
		return;
	}

	console.log(
		`[MacroHistorySeeder] Seeding FRED history from ${MACRO_HISTORY_START_DATE} to ${MACRO_HISTORY_END_DATE}`
	);

	for (const series of FRED_SERIES) {
		const seeded = await hasHistoricalSeries(client, series.indicatorName);
		if (seeded) {
			console.log(`[MacroHistorySeeder] ${series.indicatorName} already seeded. Skipping.`);
			continue;
		}

		console.log(`[MacroHistorySeeder] Fetching ${series.seriesId} -> ${series.indicatorName}`);
		const points = await fetchFredSeriesHistory(series);
		if (points.length === 0) {
			console.warn(`[MacroHistorySeeder] No points returned for ${series.seriesId}.`);
			continue;
		}

		for (let index = 0; index < points.length; index += BATCH_SIZE) {
			await insertIndicatorBatch(client, points.slice(index, index + BATCH_SIZE));
		}

		console.log(`[MacroHistorySeeder] Inserted ${points.length} points for ${series.indicatorName}.`);
	}
}

async function upsertHistoricalRawArticle(client: PoolClient, event: CuratedMacroEventSeed): Promise<string> {
	const publishedAt = new Date(event.eventTime);
	const contentHash = buildContentHash([event.externalId, event.eventTime, event.title]);

	const result = await client.query<{ id: string }>(
		`
			INSERT INTO public.macro_raw_articles (
				id,
				source,
				external_id,
				url,
				title,
				body,
				language,
				published_at,
				fetched_at,
				content_hash,
				metadata
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10::jsonb)
			ON CONFLICT (content_hash) DO UPDATE SET
				source = EXCLUDED.source,
				external_id = EXCLUDED.external_id,
				url = EXCLUDED.url,
				title = EXCLUDED.title,
				body = EXCLUDED.body,
				language = EXCLUDED.language,
				published_at = EXCLUDED.published_at,
				metadata = EXCLUDED.metadata
			RETURNING id;
		`,
		[
			randomUUID(),
			"HistoricalMacroSeed",
			event.externalId,
			event.referenceUrl,
			event.title,
			event.canonicalText,
			"en",
			publishedAt,
			contentHash,
			JSON.stringify({
				curated_seed: true,
				source_type: "historical_macro_event",
				reference_url: event.referenceUrl,
			}),
		]
	);

	return result.rows[0].id;
}

async function eventExistsForRawArticle(client: PoolClient, rawArticleId: string): Promise<boolean> {
	const existing = await client.query<{ id: string }>(
		"SELECT id FROM public.macro_events WHERE raw_article_id = $1 LIMIT 1;",
		[rawArticleId]
	);
	return existing.rows.length > 0;
}

async function insertHistoricalMacroEvent(
	client: PoolClient,
	rawArticleId: string,
	event: CuratedMacroEventSeed
): Promise<void> {
	await client.query(
		`
			INSERT INTO public.macro_events (
				id,
				raw_article_id,
				event_time,
				event_type,
				channel,
				severity,
				region,
				country_codes,
				affected_assets,
				canonical_text,
				extraction_model,
				extraction_version,
				confidence,
				metadata
			)
			VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8::TEXT[], $9::TEXT[], $10, $11, $12, $13, $14::jsonb
			);
		`,
		[
			randomUUID(),
			rawArticleId,
			new Date(event.eventTime),
			event.eventType,
			event.channel,
			event.severity,
			event.region,
			event.countryCodes,
			event.affectedAssets,
			event.canonicalText,
			"historical-curation",
			"v1",
			0.92,
			JSON.stringify({
				curated_seed: true,
				external_id: event.externalId,
				reference_url: event.referenceUrl,
			}),
		]
	);
}

async function seedCuratedMacroEvents(client: PoolClient): Promise<void> {
	console.log("[MacroHistorySeeder] Seeding curated macro historical events...");
	let insertedCount = 0;
	let skippedCount = 0;

	for (const event of CURATED_MACRO_EVENTS) {
		try {
			const rawArticleId = await upsertHistoricalRawArticle(client, event);
			const exists = await eventExistsForRawArticle(client, rawArticleId);
			if (exists) {
				skippedCount += 1;
				continue;
			}
			await insertHistoricalMacroEvent(client, rawArticleId, event);
			insertedCount += 1;
		} catch (error) {
			console.error(`[MacroHistorySeeder] Failed to seed curated event ${event.externalId}:`, error);
			throw error;
		}
	}

	console.log(
		`[MacroHistorySeeder] Curated macro events complete. inserted=${insertedCount} skipped=${skippedCount}`
	);
}

async function run(): Promise<void> {
	console.log("--- [MacroHistorySeeder] Starting macro historical seeder ---");
	const pool = new Pool(DB_CONFIG);
	const client = await pool.connect();

	try {
		await seedFredHistory(client);
		await seedCuratedMacroEvents(client);
		console.log("--- [MacroHistorySeeder] Completed successfully ---");
	} finally {
		client.release();
		await pool.end();
	}
}

run()
	.catch((error) => {
		console.error("[MacroHistorySeeder] Seeder failed:", error);
		process.exit(1);
	})
	.finally(() => {
		process.exit(0);
	});

