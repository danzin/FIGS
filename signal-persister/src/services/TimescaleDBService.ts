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
		// Fixed: Changed 'name' to 'asset_symbol' in the conflict clause
		const insertMarketText = `
      INSERT INTO public.market_data
        (time, asset_symbol, "type", value, source)
      VALUES
        ($1, $2, $3, $4, $5)
      
    `;

		try {
			// Added validation logging
			console.log(`[DB] Attempting to insert market data:`, {
				time: point.time,
				asset_symbol: point.asset_symbol,
				type: point.type,
				value: point.value,
				source: point.source,
			});

			const res = await this.pool.query(insertMarketText, [
				point.time,
				point.asset_symbol,
				point.type,
				point.value,
				point.source,
			]);

			console.log(`[DB] market_data insert result: rowCount=${res.rowCount}, command=${res.command}`);

			if (res.rowCount === 0) {
				console.warn(
					`[DB] No rows inserted for market_data - likely duplicate: ${point.asset_symbol} ${point.type} at ${point.time}`
				);
			} else {
				console.log(`[DB] Successfully inserted market data: ${point.asset_symbol} ${point.type}`);
			}
		} catch (error) {
			console.error(`[DB] Error inserting market data for ${point.asset_symbol}:`, error);
			console.error(`[DB] Failed data point:`, point);
			throw error;
		}
	}

	/**
	 * Inserts a general indicator into the market_indicators table.
	 */
	public async insertIndicator(point: IndicatorDataPoint): Promise<void> {
		const text = `
      INSERT INTO public.market_indicators (time, name, value, source)
			VALUES ($1, $2, $3, $4)
    `;

		try {
			// Added validation logging
			console.log(`[DB] Attempting to insert indicator:`, {
				time: point.time,
				name: point.name,
				value: point.value,
				source: point.source,
			});

			// Fixed: Parameters now match SQL column order (time, name, value, source)
			const res = await this.pool.query(text, [point.time, point.name, point.value, point.source]);

			console.log(`[DB] market_indicators insert result: rowCount=${res.rowCount}, command=${res.command}`);

			if (res.rowCount === 0) {
				console.warn(
					`[DB] No rows inserted for indicator - this shouldn't happen with ON CONFLICT DO UPDATE: ${point.name}`
				);
			} else {
				console.log(`[DB] Successfully inserted/updated indicator: ${point.name}`);
			}
		} catch (error) {
			console.error(`[DB] Error inserting indicator ${point.name}:`, error);
			console.error(`[DB] Failed data point:`, point);
			throw error;
		}
	}

	public async disconnect(): Promise<void> {
		await this.pool.end();
		console.log("[TimescaleDBService] Database pool has ended.");
	}
}
