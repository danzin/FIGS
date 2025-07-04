import { Pool } from "pg";
import { DatabaseService } from "./database.interface";
import { MarketDataPoint, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

interface DbConfig {
	user?: string;
	host?: string;
	database?: string;
	password?: string;
	port?: number;
}

export class TimescaleDBService implements DatabaseService {
	private pool: Pool;

	constructor(dbConfig: DbConfig) {
		this.pool = new Pool(dbConfig);
		this.pool.on("connect", () => console.log("[TimescaleDBService] Connected to database."));
		this.pool.on("error", (err) => {
			console.error("[TimescaleDBService] Unexpected error on idle client", err);
			process.exit(0);
		});
	}

	public async connect(): Promise<void> {
		try {
			await this.pool.query("SELECT NOW()");
			console.log("[TimescaleDBService] Database connection test successful.");
		} catch (error) {
			console.error("[TimescaleDBService] Database connection test failed.", error);
			throw error;
		}
	}

	/**
	 * Inserts asset-specific data (price or volume) into the market_data table.
	 */
	public async insertMarketData(point: MarketDataPoint): Promise<void> {
		const insertMarketText = `
			INSERT INTO public.market_data
				(time, asset_symbol, "type", value, source)
			VALUES
				($1, $2, $3, $4, $5)
			ON CONFLICT (time, name, source) DO NOTHING;
			`;
		try {
			const res = await this.pool.query(insertMarketText, [
				point.time,
				point.asset_symbol,
				point.type,
				point.value,
				point.source,
			]);
			// console.log(`[DB] Inserted market data: ${point.asset_symbol} ${point.type}`);
			console.log(`[DB] market_data rowCount=${res.rowCount}`);
		} catch (error) {
			console.error(`[DB] Error inserting market data for ${point.asset_symbol}:`, error);
			throw error;
		}
	}

	/**
	 * Inserts a general indicator into the market_indicators table.
	 * This uses ON CONFLICT...DO UPDATE to always store the latest value for a given indicator name.
	 */
	public async insertIndicator(point: IndicatorDataPoint): Promise<void> {
		const text = `
			INSERT INTO public.market_indicators (time, name, value, source)
			VALUES ($1,$2,$3,$4)
			ON CONFLICT (name) DO NOTHING
			`;
		try {
			await this.pool.query(text, [point.name, point.time, point.value, point.source]);
			// console.log(`[DB] Inserted/Updated indicator: ${point.name}`);
		} catch (error) {
			console.error(`[DB] Error inserting indicator ${point.name}:`, error);
			throw error;
		}
	}

	public async disconnect(): Promise<void> {
		await this.pool.end();
		console.log("[TimescaleDBService] Database pool has ended.");
	}
}
