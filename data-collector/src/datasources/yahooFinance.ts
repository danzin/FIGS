import axios from "axios";
import { DataSource } from "./Datasource";
import { Signal } from "../models/signal.interface";

export class YahooFinanceSource implements DataSource {
	public key: string;
	private readonly symbol: string;
	private readonly metric: string;

	constructor(symbol: string, metric: "price" | "volume" = "price") {
		this.symbol = symbol;
		this.metric = metric;
		this.key = `yahoo_${symbol}_${metric}`;
	}

	async fetch(): Promise<Signal | null> {
		try {
			// Using Yahoo Finance's v8 finance API endpoint
			const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${this.symbol}`, {
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				},
				timeout: 10000,
			});

			const result = response.data?.chart?.result?.[0];
			if (!result) {
				console.warn(`No chart data returned for ${this.symbol} from Yahoo Finance`);
				return null;
			}

			const meta = result.meta;
			const timestamps = result.timestamp;
			const quotes = result.indicators?.quote?.[0];

			if (!meta || !timestamps || !quotes) {
				console.warn(`Incomplete data structure for ${this.symbol} from Yahoo Finance`);
				return null;
			}

			// Get the most recent data point
			const latestIndex = timestamps.length - 1;
			const latestTimestamp = new Date(timestamps[latestIndex] * 1000);

			let value: number;
			switch (this.metric) {
				case "price":
					// Use regularMarketPrice from meta for current price, fallback to latest close
					value = meta.regularMarketPrice || quotes.close[latestIndex];
					break;
				case "volume":
					value = quotes.volume[latestIndex];
					break;
				default:
					throw new Error(`Unknown metric: ${this.metric}`);
			}

			if (typeof value !== "number" || isNaN(value) || value === null) {
				console.warn(`Invalid ${this.metric} value for ${this.symbol}: ${value}`);
				return null;
			}

			return {
				name: this.key,
				timestamp: latestTimestamp,
				value,
				source: "Yahoo Finance",
			};
		} catch (error) {
			console.error(`Error fetching ${this.symbol} ${this.metric} from Yahoo Finance:`, error);
			if (axios.isAxiosError(error)) {
				if (error.response?.status === 404) {
					throw new Error(`Symbol ${this.symbol} not found on Yahoo Finance`);
				}
				if (error.response?.status === 429) {
					throw new Error(`Yahoo Finance rate limit exceeded`);
				}
			}
			throw error;
		}
	}
}

export class VIXSource extends YahooFinanceSource {
	constructor() {
		super("^VIX", "price");
		this.key = "vix_level";
	}
}

export class SPYSource extends YahooFinanceSource {
	constructor() {
		super("SPY", "price");
		this.key = "spy_price";
	}
}
