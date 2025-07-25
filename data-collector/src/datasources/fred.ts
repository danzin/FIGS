import axios from "axios";
import { DataSource } from "@financialsignalsgatheringsystem/common";
import { IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

export class FredSource implements DataSource {
	public key: string;
	private readonly apiKey: string;
	private readonly series_id: string;
	constructor(apiKey: string, series_id: string) {
		this.apiKey = apiKey;
		this.series_id = series_id;
		this.key = `FRED_${series_id}`;
	}
	async fetch(): Promise<IndicatorDataPoint[] | null> {
		try {
			const response = await axios.get("https://api.stlouisfed.org/fred/series/observations", {
				headers: {
					"Content-Type": "application/json",
				},
				params: {
					series_id: this.series_id,
					api_key: this.apiKey,
					file_type: "json",
					frequency: "m",
				},
			});

			if (!response.data || !response.data.observations || response.data.observations.length === 0) {
				// logger.warn(`No observations returned for series_id ${this.series_id} from FRED.`);
				console.warn(`No observations returned for series_id ${this.series_id} from FRED.`);
				return null;
			}
			const latestObservation = response.data.observations.pop();
			if (
				latestObservation.value === "." ||
				latestObservation.value === null ||
				latestObservation.value === undefined
			) {
				// logger.warn(`Invalid or missing value for M2SL on ${latestObservation.date}`);
				console.warn(`Invalid or missing value for ${this.series_id} on ${latestObservation.date}`);
				return null;
			}
			const value = parseFloat(latestObservation.value);
			if (isNaN(value)) {
				// logger.warn(`Parsed NaN for M2SL on ${latestObservation.date}, original value: ${latestObservation.value}`);
				console.warn(
					`Parsed NaN for ${this.series_id} on ${latestObservation.date}, original value: ${latestObservation.value}`
				);
				return null;
			}
			const point: IndicatorDataPoint = {
				name: this.key,
				time: new Date(latestObservation.date),
				value: parseFloat(latestObservation.value),
				source: "FRED",
			};
			return [point];
		} catch (error) {
			// logger.error(`Error fetching data from FRED for ${this.series_id}:`, { error });
			console.error(`Error fetching data from FRED for ${this.series_id}:`, error);
			if (axios.isAxiosError(error)) {
				throw new Error(`FRED API Error (${error.response?.status}): ${error.message}`);
			}
			throw error;
		}
	}
}
