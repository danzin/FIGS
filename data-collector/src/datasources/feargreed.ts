import axios from "axios";
import { DataSource } from "@financialsignalsgatheringsystem/common";
import { IndicatorDataPoint, Signal } from "@financialsignalsgatheringsystem/common";

export class FearGreedSource implements DataSource<IndicatorDataPoint> {
	public key = "fear_greed_index";

	async fetch(): Promise<IndicatorDataPoint[] | null> {
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
			const time = new Date(parseInt(data.timestamp) * 1000);

			if (isNaN(value) || value < 0 || value > 100) {
				console.warn(`Invalid Fear & Greed value: ${data.value}`);
				return null;
			}

			if (isNaN(time.getTime())) {
				console.warn(`Invalid Fear & Greed timestamp: ${data.timestamp}`);
				return null;
			}
			const point: IndicatorDataPoint = {
				name: this.key,
				time,
				value,
				source: "Alternative.me",
			};
			return [point];
		} catch (error) {
			console.error("Error fetching Fear & Greed Index:", error);
			if (axios.isAxiosError(error) && error.response?.status === 429) {
				throw new Error("Fear & Greed API rate limit exceeded");
			}
			throw error;
		}
	}
}
