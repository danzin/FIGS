import axios from "axios";
import { DataSource } from "./Datasource";
import { Signal } from "@financialsignalsgatheringsystem/common";

export class FearGreedSource implements DataSource {
	public key = "fear_greed_index";

	async fetch(): Promise<Signal | null> {
		try {
			const response = await axios.get("https://api.alternative.me/fng/", {
				headers: {
					Accept: "application/json",
				},
				timeout: 10000,
			});

			const data = response.data?.data?.[0];
			if (!data) {
				console.warn("No Fear & Greed data returned");
				return null;
			}

			const value = parseInt(data.value);
			const timestamp = new Date(parseInt(data.timestamp) * 1000);

			if (isNaN(value) || value < 0 || value > 100) {
				console.warn(`Invalid Fear & Greed value: ${data.value}`);
				return null;
			}

			if (isNaN(timestamp.getTime())) {
				console.warn(`Invalid Fear & Greed timestamp: ${data.timestamp}`);
				return null;
			}

			return {
				name: this.key,
				timestamp,
				value,
				source: "Alternative.me",
			};
		} catch (error) {
			console.error("Error fetching Fear & Greed Index:", error);
			if (axios.isAxiosError(error) && error.response?.status === 429) {
				throw new Error("Fear & Greed API rate limit exceeded");
			}
			throw error;
		}
	}
}
