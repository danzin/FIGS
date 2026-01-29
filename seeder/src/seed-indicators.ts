import { Pool } from "pg";
import axios from "axios";
import { IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

const DB_CONFIG = {
	user: process.env.DB_USER || "postgres",
	host: process.env.DB_HOST || "localhost",
	database: process.env.DB_NAME || "market_signals",
	password: process.env.DB_PASSWORD || "postgres",
	port: parseInt(process.env.DB_PORT || "5432", 10),
};

const pool = new Pool(DB_CONFIG);

async function insertIndicators(points: IndicatorDataPoint[]): Promise<void> {
	const filtered = points.filter((p): p is IndicatorDataPoint => Boolean(p));
	if (filtered.length === 0) {
		return;
	}

	const client = await pool.connect();
	try {
		const query = `
      INSERT INTO public.market_indicators (time, name, value, source)
      SELECT * FROM UNNEST(
        $1::TIMESTAMPTZ[],
        $2::TEXT[],
        $3::DOUBLE PRECISION[],
        $4::TEXT[]
      )
      ON CONFLICT DO NOTHING
    `;

		const values = filtered.reduce(
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
	} finally {
		client.release();
	}
}

async function fetchYahooHistoricalIndicator(symbol: string, name: string): Promise<IndicatorDataPoint[]> {
	const points: IndicatorDataPoint[] = [];
	try {
		const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
			params: { interval: "1d", range: "3mo" }, // 3 months of daily data
			headers: { "User-Agent": "Mozilla/5.0" },
			timeout: 10000,
		});
		const result = response.data?.chart?.result?.[0];
		if (!result) return points;

		const timestamps = result.timestamp;
		const quotes = result.indicators.quote[0].close;

		for (let i = 0; i < timestamps.length; i++) {
			if (quotes[i] !== null && quotes[i] !== undefined) {
				points.push({
					name,
					time: new Date(timestamps[i] * 1000),
					value: quotes[i],
					source: "YahooFinance-Seed",
				});
			}
		}

		console.log(`[IndicatorSeeder] Fetched ${points.length} historical points for ${symbol}`);
	} catch (err) {
		console.error(`[IndicatorSeeder] Failed to fetch ${symbol}:`, err);
	}
	return points;
}

async function fetchStooqHistoricalIndicator(symbol: string, name: string): Promise<IndicatorDataPoint[]> {
	const points: IndicatorDataPoint[] = [];
	try {
		const response = await axios.get(`https://stooq.com/q/d/l/`, {
			params: { s: symbol, i: "d" },
			responseType: "text",
			timeout: 15000,
		});
		const body = typeof response.data === "string" ? response.data : "";
		const lines = body.trim().split("\n");
		if (lines.length <= 1) return points;
		for (let i = 1; i < lines.length; i++) {
			const [date, , , , close] = lines[i].split(",");
			const value = Number(close);
			if (!date || Number.isNaN(value)) continue;
			points.push({
				name,
				time: new Date(date),
				value,
				source: "Stooq-Seed",
			});
		}
		console.log(`[IndicatorSeeder] Fetched ${points.length} historical points from Stooq for ${symbol}`);
	} catch (err) {
		console.error(`[IndicatorSeeder] Failed to fetch ${symbol} from Stooq:`, err);
	}
	return points;
}

async function fetchDefiLlamaStablecoinHistory(): Promise<IndicatorDataPoint[]> {
	const points: IndicatorDataPoint[] = [];
	try {
		const response = await axios.get("https://stablecoins.llama.fi/stablecoincharts/all", {
			headers: { Accept: "application/json" },
			timeout: 15000,
		});
		const data = response.data;
		if (!data || typeof data !== "object") return points;

		const allChainKey = Object.keys(data).find((key) => key.toLowerCase() === "all");
		const allChainData = allChainKey ? data[allChainKey] : Object.values(data).flat();
		if (!Array.isArray(allChainData)) return points;

		const ninetyDaysAgo = Date.now() / 1000 - 90 * 24 * 60 * 60;
		for (const item of allChainData) {
			if (!item?.totalCirculatingUSD?.peggedUSD || !item?.date) continue;
			if (Number(item.date) < ninetyDaysAgo) continue;
			points.push({
				name: "stablecoin_total_supply",
				time: new Date(Number(item.date) * 1000),
				value: Number(item.totalCirculatingUSD.peggedUSD),
				source: "DefiLlama-Seed",
			});
		}
		console.log(`[IndicatorSeeder] Fetched ${points.length} stablecoin total supply points`);
	} catch (err) {
		console.error("[IndicatorSeeder] Failed to fetch stablecoin history:", err);
	}
	return points;
}

async function fetchCoinGeckoDominanceHistory(): Promise<IndicatorDataPoint[]> {
	const points: IndicatorDataPoint[] = [];
	try {
		// CoinGecko global endpoint only gives current, so we'll just add current
		const response = await axios.get("https://api.coingecko.com/api/v3/global");
		const dominance = response.data?.data?.market_cap_percentage?.btc;
		if (typeof dominance === "number") {
			points.push({
				name: "btc_dominance",
				time: new Date(),
				value: dominance,
				source: "CoinGecko-Seed",
			});
		}
		console.log(`[IndicatorSeeder] Fetched BTC dominance: ${dominance}%`);
	} catch (err) {
		console.error("[IndicatorSeeder] Failed to fetch btc_dominance:", err);
	}
	return points;
}

async function fetchFearGreedHistory(): Promise<IndicatorDataPoint[]> {
	const points: IndicatorDataPoint[] = [];
	try {
		// Alternative.me Fear & Greed API - free, no key required
		const response = await axios.get("https://api.alternative.me/fng/?limit=90");
		const data = response.data?.data;

		if (data && Array.isArray(data)) {
			for (const item of data) {
				points.push({
					name: "fear_greed_index",
					time: new Date(parseInt(item.timestamp) * 1000),
					value: parseInt(item.value),
					source: "Alternative.me-Seed",
				});
			}
		}
		console.log(`[IndicatorSeeder] Fetched ${points.length} Fear & Greed historical points`);
	} catch (err) {
		console.error("[IndicatorSeeder] Failed to fetch fear_greed_index:", err);
	}
	return points;
}

export async function seedIndicators(): Promise<void> {
	console.log("--- [IndicatorSeeder] Starting Historical Indicators Seeder ---");

	// Check if we already have seeded data
	const client = await pool.connect();
	try {
		const { rows } = await client.query(
			"SELECT COUNT(*) as count FROM public.market_indicators WHERE source LIKE '%-Seed'"
		);
		if (parseInt(rows[0].count, 10) > 100) {
			console.log("--- [IndicatorSeeder] Indicator data already exists. Skipping. ---");
			return;
		}
	} finally {
		client.release();
	}

	// Fetch historical data for multiple indicators
	const [vixHistory, spyHistory, dominance, fearGreed, stablecoinHistory] = await Promise.all([
		fetchStooqHistoricalIndicator("vix", "vix_level"),
		fetchStooqHistoricalIndicator("spy", "spy_price"),
		fetchCoinGeckoDominanceHistory(),
		fetchFearGreedHistory(),
		fetchDefiLlamaStablecoinHistory(),
	]);

	const allIndicators = [...vixHistory, ...spyHistory, ...dominance, ...fearGreed, ...stablecoinHistory];

	// Insert in batches
	const BATCH_SIZE = 500;
	for (let i = 0; i < allIndicators.length; i += BATCH_SIZE) {
		await insertIndicators(allIndicators.slice(i, i + BATCH_SIZE));
	}

	console.log(`--- [IndicatorSeeder] Seeded ${allIndicators.length} total indicator records ---`);
}

seedIndicators()
	.catch((err) => {
		console.error("[IndicatorSeeder] Failed:", err);
		process.exit(1);
	})
	.finally(async () => {
		await pool.end();
		process.exit(0);
	});
