import { Pool, PoolClient } from "pg";
import axios from "axios";
import { MarketDataPoint } from "@financialsignalsgatheringsystem/common";

const DB_CONFIG = {
	user: process.env.DB_USER || "postgres",
	host: process.env.DB_HOST || "localhost",
	database: process.env.DB_NAME || "market_signals",
	password: process.env.DB_PASSWORD || "postgres",
	port: parseInt(process.env.DB_PORT || "5432"),
};

const BATCH_SIZE = 500;

async function insertMarketDataBatch(client: PoolClient, data: MarketDataPoint[]) {
	if (data.length === 0) return;
	const query = `
        INSERT INTO public.market_data (time, asset_symbol, type, value, source)
        SELECT * FROM UNNEST(
            $1::TIMESTAMPTZ[], $2::TEXT[], $3::TEXT[],
            $4::DOUBLE PRECISION[], $5::TEXT[]
        )
        ON CONFLICT DO NOTHING;
    `;
	const values = data.reduce(
		(acc, d) => {
			acc[0].push(d.time);
			acc[1].push(d.asset_symbol);
			acc[2].push(d.type);
			acc[3].push(d.value);
			acc[4].push(d.source);
			return acc;
		},
		[[], [], [], [], []] as [Date[], string[], string[], number[], string[]]
	);
	await client.query(query, values);
}

async function seedDefiLlamaTVL(client: PoolClient, chain: string, assetSymbol: string) {
	console.log(`[Seeder] Fetching historical TVL for ${chain}...`);
	try {
		const response = await axios.get(`https://api.llama.fi/v2/historicalChainTvl/${chain}`);
		const data = response.data; // Array of { date: unix_timestamp, tvl: number }

		const points: MarketDataPoint[] = [];
		// Filter for last 90 days
		const ninetyDaysAgo = Date.now() / 1000 - 90 * 24 * 60 * 60;

		for (const item of data) {
			if (Number(item.date) < ninetyDaysAgo) continue;

			points.push({
				time: new Date(Number(item.date) * 1000),
				asset_symbol: assetSymbol,
				type: "tvl",
				value: Number(item.tvl),
				source: "DefiLlama-Seed",
			});
		}

		for (let i = 0; i < points.length; i += BATCH_SIZE) {
			await insertMarketDataBatch(client, points.slice(i, i + BATCH_SIZE));
		}
		console.log(`[Seeder] -> Seeded ${points.length} TVL records for ${chain}.`);
	} catch (error) {
		console.error(`[Seeder] Failed to seed TVL for ${chain}:`, error);
	}
}

async function seedBlockchainComActiveAddresses(client: PoolClient) {
	console.log(`[Seeder] Fetching historical Active Addresses for Bitcoin...`);
	try {
		// Fetch 3 months (approx 90 days)
		const response = await axios.get(
			"https://api.blockchain.info/charts/n-unique-addresses?timespan=3months&format=json"
		);
		const values = response.data?.values; // Array of { x: unix_timestamp, y: value }

		if (!values) return;

		const points: MarketDataPoint[] = [];
		for (const item of values) {
			points.push({
				time: new Date(item.x * 1000),
				asset_symbol: "bitcoin",
				type: "active_addresses",
				value: item.y,
				source: "Blockchain.com-Seed",
			});
		}

		for (let i = 0; i < points.length; i += BATCH_SIZE) {
			await insertMarketDataBatch(client, points.slice(i, i + BATCH_SIZE));
		}
		console.log(`[Seeder] -> Seeded ${points.length} Active Address records for Bitcoin.`);
	} catch (error) {
		console.error(`[Seeder] Failed to seed Active Addresses:`, error);
	}
}

async function seedFundamentalData() {
	console.log("--- [Seeder] Starting Fundamental Data Seeder ---");
	const pool = new Pool(DB_CONFIG);
	let client: PoolClient | null = null;

	try {
		client = await pool.connect();

		// Check if we already have fundamental data
		const { rows } = await client.query(
			"SELECT COUNT(*) as count FROM public.market_data WHERE source IN ('DefiLlama-Seed', 'Blockchain.com-Seed')"
		);

		if (parseInt(rows[0].count, 10) > 0) {
			console.log("--- [Seeder] Fundamental data already exists. Skipping. ---");
			return;
		}

		await seedDefiLlamaTVL(client, "Ethereum", "ethereum");
		await seedDefiLlamaTVL(client, "Solana", "solana");
		await seedBlockchainComActiveAddresses(client);
	} catch (error) {
		console.error("--- [Seeder] Fundamental Seeding process failed ---", error);
		process.exit(1);
	} finally {
		if (client) client.release();
		await pool.end();
		console.log("\n--- [Seeder] Fundamental Seeding process completed ---");
		process.exit(0);
	}
}

seedFundamentalData();
