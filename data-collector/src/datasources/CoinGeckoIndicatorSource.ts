import axios from "axios";
import { DataSource, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

type IndicatorMetric = "btc_dominance" | "btc_volume";

export class CoinGeckoIndicatorSource implements DataSource {
	public readonly key: string;
	private readonly metric: IndicatorMetric;

	constructor(metric: IndicatorMetric) {
		this.metric = metric;
		this.key = `coingecko_${metric}`;
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		if (this.metric === "btc_dominance") {
			const point = await this.fetchBitcoinDominance();
			return point ? [point] : null;
		}
		console.warn(`[CoinGeckoIndicatorSource] Metric '${this.metric}' is not supported.`);
		return null;
	}

	private async fetchBitcoinDominance(): Promise<IndicatorDataPoint | null> {
		try {
			const response = await axios.get("https://api.coingecko.com/api/v3/global", {
				headers: { Accept: "application/json" },
			});

			const dominance = response.data?.data?.market_cap_percentage?.btc;
			if (typeof dominance !== "number" || isNaN(dominance)) {
				console.warn(`[CoinGeckoIndicatorSource] Invalid Bitcoin dominance value received: ${dominance}`);
				return null;
			}

			return {
				name: "btc_dominance",
				time: new Date(),
				value: dominance,
				source: "CoinGecko",
			};
		} catch (error) {
			console.error(`[CoinGeckoIndicatorSource] Error fetching Bitcoin dominance:`, error);
			if (axios.isAxiosError(error) && error.response?.status === 429) {
				throw new Error(`CoinGecko rate limit exceeded for '${this.key}'`);
			}
			throw error;
		}
	}
}
