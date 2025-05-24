import { Pool } from "pg";
import { DatabaseService } from "./database.interface";
import { Signal } from "../models/signal.interface";

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
		this.pool.on("error", (err, client) => {
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

	public async insertSignal(signal: Signal): Promise<void> {
		if (
			!signal ||
			signal.value === null ||
			typeof signal.value === "undefined" ||
			isNaN(Number(signal.value)) ||
			!signal.source
		) {
			console.warn(
				`[TimescaleDBService] Skipping insertion of invalid signal (value issue): ${JSON.stringify(signal)}`
			);
			return;
		}

		if (!(signal.timestamp instanceof Date) || isNaN(signal.timestamp.getTime())) {
			console.warn(
				`[TimescaleDBService] Skipping insertion of invalid signal (timestamp issue): ${JSON.stringify(signal)}`
			);
			return;
		}

		const query = `
            INSERT INTO public.signals (time, name, value, source)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (name, time) DO UPDATE SET 
                source = EXCLUDED.source
    `;
		try {
			await this.pool.query(query, [signal.timestamp, signal.name, signal.value, signal.source]);
			console.log(`[TimescaleDBService] Inserted/Updated signal: ${signal.name} @ ${signal.timestamp.toISOString()}`);
		} catch (error) {
			console.error(`[TimescaleDBService] Error inserting signal ${signal.name}:`, error);
			throw error; // the caller (consumer) can handle this, possibly by nack-ing the message
		}
	}

	public async disconnect(): Promise<void> {
		await this.pool.end();
		console.log("[TimescaleDBService] Database pool has ended.");
	}
}
