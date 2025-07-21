import axios from "axios";
import { DataSource } from "@financialsignalsgatheringsystem/common";
import { IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

export class YahooFinanceSource implements DataSource {
	public key: string;
	private readonly symbol: string;
	private readonly metric: "price" | "volume";

	constructor(symbol: string, metric: "price" | "volume" = "price") {
		this.symbol = symbol;
		this.metric = metric;
		this.key = `yahoo_${symbol}_${metric}`;
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		try {
			const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${this.symbol}`, {
				params: {
					interval: "1d",
					range: "1d",
				},
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
			if (!meta) {
				console.warn(`No meta data available for ${this.symbol} from Yahoo Finance`);
				return null;
			}

			console.log(`[YahooFinanceSource] Meta data for ${this.symbol}:`, {
				regularMarketPrice: meta.regularMarketPrice,
				regularMarketTime: meta.regularMarketTime,
				regularMarketVolume: meta.regularMarketVolume,
				instrumentType: meta.instrumentType,
			});

			let value: number;
			let timestamp: Date;

			timestamp = new Date(meta.regularMarketTime * 1000);

			switch (this.metric) {
				case "price":
					if (typeof meta.regularMarketPrice === "number" && !isNaN(meta.regularMarketPrice)) {
						value = meta.regularMarketPrice;
						console.log(`[YahooFinanceSource] Using regularMarketPrice for ${this.symbol}: ${value}`);
					} else {
						// Fallback to historical data if available
						const timestamps = result.timestamp;
						const quotes = result.indicators?.quote?.[0];

						if (timestamps && quotes && quotes.close && timestamps.length > 0) {
							const latestIndex = timestamps.length - 1;
							value = quotes.close[latestIndex];
							timestamp = new Date(timestamps[latestIndex] * 1000);
							console.log(`[YahooFinanceSource] Using historical close price for ${this.symbol}: ${value}`);
						} else {
							console.warn(`No price data available for ${this.symbol}`);
							return null;
						}
					}
					break;

				case "volume":
					if (typeof meta.regularMarketVolume === "number" && !isNaN(meta.regularMarketVolume)) {
						value = meta.regularMarketVolume;
						console.log(`[YahooFinanceSource] Using regularMarketVolume for ${this.symbol}: ${value}`);
					} else {
						const timestamps = result.timestamp;
						const quotes = result.indicators?.quote?.[0];

						if (timestamps && quotes && quotes.volume && timestamps.length > 0) {
							const latestIndex = timestamps.length - 1;
							value = quotes.volume[latestIndex];
							timestamp = new Date(timestamps[latestIndex] * 1000);
							console.log(`[YahooFinanceSource] Using historical volume for ${this.symbol}: ${value}`);
						} else {
							console.warn(`No volume data available for ${this.symbol}`);
							return null;
						}
					}
					break;

				default:
					throw new Error(`Unknown metric: ${this.metric}`);
			}

			// Final validation
			if (typeof value !== "number" || isNaN(value) || value === null) {
				console.warn(`Invalid ${this.metric} value for ${this.symbol}: ${value}`);
				return null;
			}

			console.log(
				`[YahooFinanceSource] Successfully fetched ${this.metric} for ${this.symbol}: ${value} at ${timestamp.toISOString()}`
			);

			return [
				{
					time: timestamp,
					name: this.symbol,
					value,
					source: "Yahoo Finance",
				},
			];
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

export class BrentCrudeOilSource implements DataSource {
	public key: string;
	private static readonly BRENT_SYMBOLS = ["BZ=F", "BZT=F", "^SGICBRB"];
	private sources: YahooFinanceSource[];
	private currentSourceIndex = 0;

	constructor() {
		this.key = "brent_crude_oil_price";
		// Separate source for each symbol
		this.sources = BrentCrudeOilSource.BRENT_SYMBOLS.map((symbol) => new YahooFinanceSource(symbol, "price"));
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		// Try each source in order starting with the last successful one
		for (const source of this.sources) {
			try {
				const result = await source.fetch();
				if (result && result.length > 0) {
					return [
						{
							time: result[0].time,
							name: this.key,
							value: result[0].value,
							source: result[0].source,
						},
					];
				}
			} catch (error) {
				console.warn(`Failed to fetch from ${source.key}:`, error);
			}
		}
		console.error(`[BrentCrudeOilSource] All Brent crude oil symbols failed`);
		return null;
	}
}
