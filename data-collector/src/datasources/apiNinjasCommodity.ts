import axios from "axios";
import { DataSource } from "./Datasource";
import { Signal } from "@financialsignalsgatheringsystem/common";

export class ApiNinjasCommoditySource implements DataSource {
	public readonly key: string;
	private readonly apiKey: string;
	private readonly commodityName: string;

	constructor(apiKey: string, commodityName: "Brent Crude Oil" | "gold" | "silver" | string) {
		if (!apiKey) {
			throw new Error("[ApiNinjasCommoditySource] API key is required and was not provided.");
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
			console.log(`[ApiNinjasCommoditySource] Response data for '${this.commodityName}':`, data);
			if (!data) return null;

			const value = Number(data.price);
			let timestamp: Date;
			if (typeof data.timestamp === "number") {
				timestamp = new Date(data.timestamp * 1000);
			} else {
				timestamp = new Date(data.timestamp);
			}

			if (isNaN(value)) {
				console.warn(`[ApiNinjasCommoditySource] Invalid price value for '${this.commodityName}': ${data.price}`);
				return null;
			}

			if (isNaN(timestamp.getTime())) {
				console.warn(`[ApiNinjasCommoditySource] Invalid timestamp for '${this.commodityName}': ${data.timestamp}`);
				return null;
			}
			console.log(
				`[ApiNinjasCommoditySource] Fetched price for '${this.commodityName}': ${value} at ${timestamp.toISOString()}`
			);
			return {
				name: this.key,
				timestamp,
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
