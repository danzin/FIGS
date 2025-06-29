import axios from "axios";
import { DataSource } from "./Datasource";
import { Signal } from "@financialsignalsgatheringsystem/common";

export class ApiNinjasCommoditySource implements DataSource {
	public readonly key: string;
	private readonly apiKey: string;
	private readonly commodityName: string;

	constructor(apiKey: string, commodityName: "oil" | "gold" | "silver" | string) {
		if (!apiKey) {
			throw new Error("[ApiNinjasCommoditySource] API key is required.");
		}
		this.apiKey = apiKey;
		this.commodityName = commodityName.toLowerCase();
		this.key = `commodity_${this.commodityName.replace(/\s+/g, "_")}_price`;
	}

	async fetch(): Promise<Signal | null> {
		try {
			const response = await axios.get(`https://api.api-ninjas.com/v1/commodityprice`, {
				params: {
					name: this.commodityName,
				},
				headers: {
					"X-Api-Key": this.apiKey,
					Accept: "application/json",
				},
				timeout: 10000,
			});

			// API-Ninjas returns an array even for a single unit
			const data = response.data?.[0];

			if (!data || typeof data.price === "undefined") {
				console.warn(`[ApiNinjasCommoditySource] No price data returned for '${this.commodityName}'`);
				return null;
			}

			const value = parseFloat(data.price);
			const timestamp = new Date(data.timestamp * 1000);

			if (isNaN(value)) {
				console.warn(`[ApiNinjasCommoditySource] Invalid price value for '${this.commodityName}': ${data.price}`);
				return null;
			}

			if (isNaN(timestamp.getTime())) {
				console.warn(`[ApiNinjasCommoditySource] Invalid timestamp for '${this.commodityName}': ${data.timestamp}`);
				return null;
			}

			return {
				name: this.key,
				timestamp: timestamp,
				value: value,
				source: "API Ninjas",
			};
		} catch (error) {
			console.error(`[ApiNinjasCommoditySource] Error fetching price for '${this.commodityName}':`, error);
			if (axios.isAxiosError(error)) {
				if (error.response?.status === 401 || error.response?.status === 403) {
					throw new Error(`API Ninjas API Key is invalid or unauthorized.`);
				}
				if (error.response?.status === 429) {
					throw new Error(`API Ninjas rate limit exceeded for '${this.commodityName}'.`);
				}
			}
			// Re-throw the original error for the scheduler to handle retries
			throw error;
		}
	}
}
