import { Pool } from "pg";
import { DatabaseService } from "./database.interface";
import { MarketDataPoint, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

interface SentimentResult {
	external_id: string;
	source: string;
	title: string;
	url: string;
	published_at: string; // Comes as ISO string
	sentiment_score: number;
	sentiment_label: string;
}

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
	 * Inserts a market data point (price, volume, rank).
	 * It will automatically create an entry in the `assets` table if the symbol is new.
	 */
	public async insertMarketData(point: MarketDataPoint): Promise<void> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			const assetUpsertQuery = `
							INSERT INTO public.assets (symbol, name, category, updated_at)
							VALUES ($1, $2, $3, NOW())
							ON CONFLICT (symbol) DO UPDATE
							SET updated_at = NOW();
            `;

			const assetName = point.asset_symbol.charAt(0).toUpperCase() + point.asset_symbol.slice(1).replace(/_/g, " ");
			const assetCategory = "crypto";

			await client.query(assetUpsertQuery, [point.asset_symbol, assetName, assetCategory]);

			const marketDataInsertQuery = `
                INSERT INTO public.market_data (time, asset_symbol, type, value, source)
                VALUES ($1, $2, $3, $4, $5);
            `;
			await client.query(marketDataInsertQuery, [
				point.time,
				point.asset_symbol,
				point.type,
				point.value,
				point.source,
			]);

			// Commit the transaction
			await client.query("COMMIT");
		} catch (error) {
			// If anything fails, roll back the entire transaction
			await client.query("ROLLBACK");
			console.error(`[DbService] Transaction failed for market data point. Rolling back.`, { point, error });
			throw error; // Re-throw the error so the consumer knows it failed
		} finally {
			// ALWAYS release the client back to the pool
			client.release();
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
					`[DB] No rows inserted for indicator - this shouldn't happen. Likely duplicate: ${point.name} at ${point.time}`
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

	/**
	 * Inserts an article into news_articles table and a sentiment score into news_sentiment table.
	 */
	public async insertArticleAndSentiment(result: SentimentResult): Promise<void> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			// Insert the article, and if it already exists, do nothing and return the existing ID.
			const articleInsertQuery = `
                INSERT INTO public.news_articles (external_id, source, title, url, published_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (external_id) DO UPDATE SET title = EXCLUDED.title 
                RETURNING id;
            `;
			const articleRes = await client.query(articleInsertQuery, [
				result.external_id,
				result.source,
				result.title,
				result.url,
				new Date(result.published_at),
			]);

			// If the insert returned no ID, it means the row already existed
			// fetch the ID of the existing row
			let articleId: number;
			if (articleRes.rows.length > 0) {
				articleId = articleRes.rows[0].id;
			} else {
				const selectRes = await client.query("SELECT id FROM public.news_articles WHERE external_id = $1", [
					result.external_id,
				]);
				articleId = selectRes.rows[0].id;
			}

			// Insert the sentiment data linked to the article ID.
			const sentimentInsertQuery = `
                INSERT INTO public.news_sentiment (article_id, time, sentiment_score, sentiment_label, source)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (article_id, time) DO NOTHING;
            `;
			await client.query(sentimentInsertQuery, [
				articleId,
				new Date(),
				result.sentiment_score,
				result.sentiment_label,
				"sentiment-analysis-service", // The source of the *sentiment*, not the article
			]);

			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			console.error(`[DbService] Error in insertArticleAndSentiment transaction:`, error);
			throw error;
		} finally {
			client.release();
		}
	}

	public async disconnect(): Promise<void> {
		await this.pool.end();
		console.log("[TimescaleDBService] Database pool has ended.");
	}
}
