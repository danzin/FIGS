import axios from "axios";
import { DataSource, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

/**
 * Fetches Bitcoin Open Interest data from CoinGlass (public endpoints)
 * and calculates leverage flush signals
 */

interface CoinGlassOIResponse {
	data?: {
		openInterest?: number;
		openInterestChange24h?: number;
	};
}

interface CoinGlassHistoryItem {
	t: number; // timestamp
	o: number; // open interest value
}

export class OpenInterestSource implements DataSource {
	public readonly key = "open_interest";
	private readonly baseUrl = "https://open-api.coinglass.com/public/v2";

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			// Fetch aggregated BTC futures open interest
			// Note: CoinGlass public API has rate limits
			const response = await axios.get<CoinGlassOIResponse>(`${this.baseUrl}/indicator/open_interest`, {
				params: { symbol: "BTC", interval: "0" },
				headers: { Accept: "application/json" },
				timeout: 15000,
			});

			const data = response.data?.data;

			if (data?.openInterest) {
				results.push({
					name: "btc_open_interest",
					time: now,
					value: data.openInterest,
					source: "CoinGlass",
				});
			}

			if (data?.openInterestChange24h !== undefined) {
				results.push({
					name: "btc_oi_change_24h",
					time: now,
					value: data.openInterestChange24h,
					source: "CoinGlass",
				});
			}

			return results.length > 0 ? results : null;
		} catch (error) {
			console.error("[OpenInterestSource] Error fetching OI data:", error);
			// Don't throw - OI data is supplementary
			return null;
		}
	}
}

/**
 * Alternative: Fetch Open Interest from Binance Futures API (free, no key)
 * More reliable but only covers Binance exchange
 */
export class BinanceOpenInterestSource implements DataSource {
	public readonly key = "binance_open_interest";
	private readonly baseUrl = "https://fapi.binance.com";

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			// Fetch current OI for BTCUSDT perpetual
			const oiResponse = await axios.get(`${this.baseUrl}/fapi/v1/openInterest`, {
				params: { symbol: "BTCUSDT" },
				timeout: 10000,
			});

			const currentOI = parseFloat(oiResponse.data?.openInterest || "0");

			if (currentOI > 0) {
				// Get current BTC price to calculate OI in USD
				const priceResponse = await axios.get(`${this.baseUrl}/fapi/v1/ticker/price`, {
					params: { symbol: "BTCUSDT" },
					timeout: 10000,
				});

				const btcPrice = parseFloat(priceResponse.data?.price || "0");
				const oiUsd = currentOI * btcPrice;

				results.push({
					name: "binance_btc_oi",
					time: now,
					value: oiUsd,
					source: "Binance",
				});

				results.push({
					name: "binance_btc_oi_btc",
					time: now,
					value: currentOI,
					source: "Binance",
				});
			}

			// Fetch historical klines to calculate 30d change
			const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
			const histResponse = await axios.get(`${this.baseUrl}/futures/data/openInterestHist`, {
				params: {
					symbol: "BTCUSDT",
					period: "1d",
					startTime: thirtyDaysAgo,
					limit: 30,
				},
				timeout: 15000,
			});

			const histData = histResponse.data as {
				timestamp: number;
				sumOpenInterest: string;
				sumOpenInterestValue: string;
			}[];

			if (histData && histData.length >= 2) {
				const latestOI = parseFloat(histData[histData.length - 1]?.sumOpenInterestValue || "0");
				const oldestOI = parseFloat(histData[0]?.sumOpenInterestValue || "0");

				if (oldestOI > 0) {
					const change30d = ((latestOI - oldestOI) / oldestOI) * 100;

					results.push({
						name: "binance_btc_oi_change_30d",
						time: now,
						value: change30d,
						source: "Binance",
					});

					// Determine leverage status
					// >40% = overheated, <-15% = flushed
					let status = 0; // 0 = normal, 1 = overheated, -1 = flushed
					if (change30d > 40) status = 1;
					else if (change30d < -15) status = -1;

					results.push({
						name: "btc_leverage_status",
						time: now,
						value: status,
						source: "Binance",
					});
				}
			}

			console.log(`[BinanceOpenInterestSource] Fetched ${results.length} OI metrics`);
			return results.length > 0 ? results : null;
		} catch (error) {
			console.error("[BinanceOpenInterestSource] Error:", error);
			return null;
		}
	}
}

/**
 * Aggregated Open Interest from multiple exchanges via CoinGecko
 * (derivatives markets data)
 */
export class AggregatedOISource implements DataSource {
	public readonly key = "aggregated_oi";

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			// CoinGecko provides derivatives exchange data
			const response = await axios.get("https://api.coingecko.com/api/v3/derivatives/exchanges", {
				params: { per_page: 10 },
				headers: { Accept: "application/json" },
				timeout: 15000,
			});

			const exchanges = response.data || [];
			let totalOI = 0;

			for (const exchange of exchanges) {
				if (exchange.open_interest_btc) {
					totalOI += exchange.open_interest_btc;
				}
			}

			if (totalOI > 0) {
				results.push({
					name: "total_btc_oi_btc",
					time: now,
					value: totalOI,
					source: "CoinGecko",
				});
			}

			return results.length > 0 ? results : null;
		} catch (error) {
			console.error("[AggregatedOISource] Error:", error);
			return null;
		}
	}
}
