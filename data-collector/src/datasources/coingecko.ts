import axios from "axios";
import { DataSource } from "./Datasource";
import { Signal } from "@financialsignalsgatheringsystem/common";

export class CoinGeckoSource implements DataSource {
	public key: string;
	private readonly coinId: string;
	private readonly metric: string;

	constructor(coinId: string, metric: "price" | "market_cap" | "volume" | "dominance") {
		this.coinId = coinId;
		this.metric = metric;
		this.key = `coingecko_${coinId}_${metric}`;
	}

	async fetch(): Promise<Signal | null> {
		try {
			if (this.metric === "dominance" && this.coinId === "bitcoin") {
				return await this.fetchBitcoinDominance();
			}

			const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
				params: {
					ids: this.coinId,
					vs_currencies: "usd",
					include_market_cap: "true",
					include_24hr_vol: "true",
				},
				headers: {
					Accept: "application/json",
				},
			});

			const coinData = response.data[this.coinId];
			if (!coinData) {
				console.warn(`No data returned for ${this.coinId} from CoinGecko`);
				return null;
			}

			let value: number;
			switch (this.metric) {
				case "price":
					value = coinData.usd;
					break;
				case "market_cap":
					value = coinData.usd_market_cap;
					break;
				case "volume":
					value = coinData.usd_24h_vol;
					break;
				default:
					throw new Error(`Unknown metric: ${this.metric}`);
			}

			if (typeof value !== "number" || isNaN(value)) {
				console.warn(`Invalid value for ${this.coinId} ${this.metric}: ${value}`);
				return null;
			}

			return {
				name: this.key,
				timestamp: new Date(),
				value,
				source: "CoinGecko",
			};
		} catch (error) {
			console.error(`Error fetching ${this.coinId} ${this.metric} from CoinGecko:`, error);
			if (axios.isAxiosError(error) && error.response?.status === 429) {
				throw new Error(`CoinGecko rate limit exceeded`);
			}
			throw error;
		}
	}

	private async fetchBitcoinDominance(): Promise<Signal | null> {
		try {
			const response = await axios.get("https://api.coingecko.com/api/v3/global", {
				headers: { Accept: "application/json" },
			});

			const dominance = response.data?.data?.market_cap_percentage?.btc;
			if (typeof dominance !== "number" || isNaN(dominance)) {
				console.warn(`Invalid Bitcoin dominance value: ${dominance}`);
				return null;
			}

			return {
				name: this.key,
				timestamp: new Date(),
				value: dominance,
				source: "CoinGecko",
			};
		} catch (error) {
			console.error(`Error fetching Bitcoin dominance from CoinGecko:`, error);
			throw error;
		}
	}
}
