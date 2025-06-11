import { trends, GoogleTrendsApiInterestOverTimeDatapoint } from "google-trends-api-client";
import { DataSource } from "./Datasource";
import { Signal } from "../models/signal.interface";

export class GoogleTrendsSource implements DataSource {
	public key: string;
	private readonly keyword: string;
	private readonly geo: string;
	private readonly timePeriod: string; // 'today 1-m' (last month), 'now 7-d' (last 7 days)

	constructor(keyword: string, geo: string = " ", timePeriod: string = "now 7-d") {
		this.keyword = keyword;
		this.geo = geo;
		this.timePeriod = timePeriod;
		this.key = `google_trend_${keyword.toLowerCase().replace(/\s+/g, "_")}${geo ? "_" + geo.toLowerCase() : ""}`;
	}

	async fetch(): Promise<Signal | null> {
		try {
			const interestDataPoints: GoogleTrendsApiInterestOverTimeDatapoint[] = await trends.getInterestOverTime({
				keywords: [this.keyword],
				geo: this.geo,
				time: this.timePeriod,
				hl: "en-US",
				tz: 240,
			});

			if (!interestDataPoints || interestDataPoints.length === 0) {
				console.warn(`[GoogleTrendsSource] No trend data points for keyword: "${this.keyword}", geo: "${this.geo}"`);
				return null;
			}

			// The last point in the array is the most recent
			const latestDataPoint = interestDataPoints[interestDataPoints.length - 1];
			if (!latestDataPoint || !latestDataPoint.value || latestDataPoint.value.length === 0) {
				console.warn(`[GoogleTrendsSource] Invalid latest data point structure for "${this.keyword}"`);
				return null;
			}

			//queried for only one keyword, its value will be at index 0

			const value = latestDataPoint.value[0];
			// Timestamp from Google Trends is often in seconds (string), convert to milliseconds for JS Date
			const timestamp = new Date(parseInt(latestDataPoint.time) * 1000);

			if (typeof value !== "number" || isNaN(value)) {
				console.warn(`[GoogleTrendsSource] Invalid trend value for "${this.keyword}": ${value}`);
				return null;
			}
			return {
				name: this.key,
				timestamp: timestamp,
				value: value,
				source: "GoogleTrends",
			};
		} catch (error: any) {
			console.error(
				`[GoogleTrendsSource] Error fetching Google Trends for "${this.keyword}": ${error.message || error}`
			);
			if (String(error).includes("429") || (error.response && error.response.status === 429)) {
				console.warn(`[GoogleTrendsSource] Rate limited by Google Trends for "${this.keyword}".`);
			}
			throw error; // Re-throw for scheduler to handle retries
		}
	}
}
