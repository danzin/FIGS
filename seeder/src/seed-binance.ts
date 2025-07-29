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

const ASSETS_TO_SEED = [
	{ binanceSymbol: "BTCUSDT", internalSymbol: "bitcoin" },
	{ binanceSymbol: "ETHUSDT", internalSymbol: "ethereum" },
	{ binanceSymbol: "SOLUSDT", internalSymbol: "solana" },
];
const DAYS_TO_FETCH = 30;
const BATCH_SIZE = 500; // Insert 500 rows at a time

/**
 * Inserts a batch of market data points using an efficient UNNEST query.
 */
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

/**
 * Fetches, transforms, and inserts historical data for ONE single asset.
 */
async function seedSingleAsset(client: PoolClient, asset: { binanceSymbol: string; internalSymbol: string }) {
	console.log(`[Seeder] Fetching ${DAYS_TO_FETCH} days of 15m data for ${asset.internalSymbol}...`);

	const response = await axios.get("https://api.binance.com/api/v3/klines", {
		params: {
			symbol: asset.binanceSymbol,
			interval: "15m",
			limit: 1000,
		},
	});

	const klines: any[] = response.data;
	const allMarketDataPoints: MarketDataPoint[] = [];

	for (const kline of klines) {
		const [openTime, , , , close, volume] = kline;
		const timestamp = new Date(openTime);

		allMarketDataPoints.push({
			time: timestamp,
			asset_symbol: asset.internalSymbol,
			type: "price",
			value: parseFloat(close),
			source: "Binance-Seed",
		});
		allMarketDataPoints.push({
			time: timestamp,
			asset_symbol: asset.internalSymbol,
			type: "volume",
			value: parseFloat(volume),
			source: "Binance-Seed",
		});
	}

	for (let i = 0; i < allMarketDataPoints.length; i += BATCH_SIZE) {
		const batch = allMarketDataPoints.slice(i, i + BATCH_SIZE);
		await insertMarketDataBatch(client, batch);
	}

	console.log(`[Seeder] -> Seeded ${klines.length} 15-minute records for ${asset.internalSymbol}.`);
}

async function seedDatabase() {
	console.log("--- [Seeder] Starting database seeder ---");
	const pool = new Pool(DB_CONFIG);
	let client: PoolClient | null = null;

	try {
		client = await pool.connect();

		const { rows } = await client.query(
			"SELECT COUNT(*) as count FROM public.market_data WHERE source = 'Binance-Seed'"
		);
		if (parseInt(rows[0].count, 10) > 0) {
			console.log("--- [Seeder] Database already contains seed data. Exiting successfully. ---");
			return;
		}

		for (const [index, asset] of ASSETS_TO_SEED.entries()) {
			console.log(`\n--- Seeding asset ${index + 1}/${ASSETS_TO_SEED.length}: ${asset.internalSymbol} ---`);
			await seedSingleAsset(client, asset);
			await new Promise((resolve) => setTimeout(resolve, 10000));
		}

		console.log("\n[Seeder] All assets seeded. Refreshing continuous aggregates...");
		await client.query("CALL refresh_continuous_aggregate('market_data_15m', NULL, NULL);");
		await client.query("CALL refresh_continuous_aggregate('market_data_1h', NULL, NULL);");
		await client.query("CALL refresh_continuous_aggregate('market_data_1d', NULL, NULL);");
		console.log("[Seeder] -> Continuous aggregates refreshed.");
	} catch (error) {
		console.error("--- [Seeder] Seeding process failed ---", error);
		process.exit(1);
	} finally {
		if (client) client.release();
		await pool.end();
		console.log("\n--- [Seeder] Seeding process completed successfully ---");
		process.exit(0);
	}
}

seedDatabase();
