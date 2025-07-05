export interface OhlcData {
	timestamp: string; // The API sends the date as an ISO string
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number | null; // Volume can be null
}

export type Interval = "15m" | "30m" | "1h" | "1d";

export interface Signal {
	name: string;
	time: string;
	value: number;
	source: string;
}

export interface PriceDTO {
	asset: string;
	time: string;
	price: number;
	source: string;
}
