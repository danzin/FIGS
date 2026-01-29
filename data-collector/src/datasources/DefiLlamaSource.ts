import axios from "axios";
import { DataSource, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

/**
 * Fetches stablecoin supply data from DefiLlama
 * Free API, no key required
 * Endpoint: https://stablecoins.llama.fi/stablecoincharts/all
 */

interface StablecoinDataPoint {
	date: number; // Unix timestamp in seconds
	totalCirculatingUSD: {
		peggedUSD: number;
	};
}

interface StablecoinHistoryResponse {
	[key: string]: StablecoinDataPoint[];
}

export class DefiLlamaStablecoinSource implements DataSource {
	public readonly key = "defillama_stablecoin";
	private readonly baseUrl = "https://stablecoins.llama.fi";

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			// Fetch all stablecoin data
			const response = await axios.get<StablecoinHistoryResponse>(`${this.baseUrl}/stablecoincharts/all`, {
				headers: { Accept: "application/json" },
				timeout: 30000,
			});

			const data = response.data;

			// Data is keyed by chain, we want the aggregated total
			// The response has totalCirculatingUSD for each timestamp
			if (!data || typeof data !== "object") {
				console.warn("[DefiLlamaStablecoinSource] Invalid response format");
				return null;
			}

			// Get the latest data point for total stablecoin supply
			// Prefer the aggregated "all" chain if available
			const allChainKey = Object.keys(data).find((key) => key.toLowerCase() === "all");
			const allChainData = allChainKey
				? data[allChainKey]
				: Object.values(data).flat();

			if (allChainData.length === 0) {
				console.warn("[DefiLlamaStablecoinSource] No data points found");
				return null;
			}

			// Sort by date descending to get latest
			const sortedData = allChainData
				.filter((d) => d && d.totalCirculatingUSD?.peggedUSD)
				.sort((a, b) => b.date - a.date);

			if (sortedData.length === 0) {
				return null;
			}

			const latest = sortedData[0];
			const totalSupply = latest.totalCirculatingUSD.peggedUSD;

			results.push({
				name: "stablecoin_total_supply",
				time: now,
				value: totalSupply,
				source: "DefiLlama",
			});

			// Calculate YoY growth if we have enough data
			const oneYearAgo = new Date(now);
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
			const oneYearAgoTimestamp = Math.floor(oneYearAgo.getTime() / 1000);

			const yearAgoData = sortedData.find(
				(d) => Math.abs(d.date - oneYearAgoTimestamp) < 86400 * 7 // Within a week
			);

			if (yearAgoData) {
				const yearAgoSupply = yearAgoData.totalCirculatingUSD.peggedUSD;
				const yoyGrowth = ((totalSupply - yearAgoSupply) / yearAgoSupply) * 100;

				results.push({
					name: "stablecoin_yoy_growth",
					time: now,
					value: yoyGrowth,
					source: "DefiLlama",
				});
			}

			// Calculate 30-day momentum (liquidity flow index)
			const thirtyDaysAgo = new Date(now);
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			const thirtyDaysAgoTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);

			const thirtyDaysAgoData = sortedData.find((d) => Math.abs(d.date - thirtyDaysAgoTimestamp) < 86400 * 3);

			if (thirtyDaysAgoData && yearAgoData) {
				// Calculate YoY growth 30 days ago
				const sixtyDaysBeforeYearAgo = new Date(oneYearAgo);
				sixtyDaysBeforeYearAgo.setDate(sixtyDaysBeforeYearAgo.getDate() - 30);
				const sixtyDaysBeforeYearAgoTimestamp = Math.floor(sixtyDaysBeforeYearAgo.getTime() / 1000);

				const oldYearAgoData = sortedData.find((d) => Math.abs(d.date - sixtyDaysBeforeYearAgoTimestamp) < 86400 * 7);

				if (oldYearAgoData) {
					const currentYoY =
						((totalSupply - yearAgoData.totalCirculatingUSD.peggedUSD) / yearAgoData.totalCirculatingUSD.peggedUSD) *
						100;
					const pastYoY =
						((thirtyDaysAgoData.totalCirculatingUSD.peggedUSD - oldYearAgoData.totalCirculatingUSD.peggedUSD) /
							oldYearAgoData.totalCirculatingUSD.peggedUSD) *
						100;
					const liquidityFlowIndex = currentYoY - pastYoY;

					results.push({
						name: "stablecoin_liquidity_flow",
						time: now,
						value: liquidityFlowIndex,
						source: "DefiLlama",
					});
				}
			}

			console.log(`[DefiLlamaStablecoinSource] Fetched ${results.length} metrics`);
			return results;
		} catch (error) {
			console.error("[DefiLlamaStablecoinSource] Error fetching stablecoin data:", error);
			if (axios.isAxiosError(error)) {
				if (error.response?.status === 429) {
					throw new Error("DefiLlama rate limit exceeded");
				}
			}
			throw error;
		}
	}
}

/**
 * Fetches individual stablecoin breakdown (USDT, USDC, DAI, etc.)
 */
export class StablecoinBreakdownSource implements DataSource {
	public readonly key = "stablecoin_breakdown";
	private readonly baseUrl = "https://stablecoins.llama.fi";

	// Major stablecoins to track
	private readonly stablecoins = [
		{ id: "1", name: "USDT", symbol: "tether" },
		{ id: "2", name: "USDC", symbol: "usd-coin" },
		{ id: "3", name: "DAI", symbol: "dai" },
		{ id: "6", name: "FDUSD", symbol: "first-digital-usd" },
	];

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			// Fetch stablecoin list with current market caps
			const response = await axios.get(`${this.baseUrl}/stablecoins`, {
				headers: { Accept: "application/json" },
				timeout: 30000,
			});

			const stablecoins = response.data?.peggedAssets || [];

			for (const targetCoin of this.stablecoins) {
				const coin = stablecoins.find(
					(s: { symbol: string; name: string }) =>
						s.symbol?.toLowerCase() === targetCoin.name.toLowerCase() ||
						s.name?.toLowerCase().includes(targetCoin.symbol)
				);

				if (coin) {
					const marketCap = coin.circulating?.peggedUSD || coin.circulatingPrevDay?.peggedUSD || 0;

					results.push({
						name: `stablecoin_${targetCoin.name.toLowerCase()}_supply`,
						time: now,
						value: marketCap,
						source: "DefiLlama",
					});
				}
			}

			console.log(`[StablecoinBreakdownSource] Fetched ${results.length} stablecoin supplies`);
			return results;
		} catch (error) {
			console.error("[StablecoinBreakdownSource] Error:", error);
			throw error;
		}
	}
}
