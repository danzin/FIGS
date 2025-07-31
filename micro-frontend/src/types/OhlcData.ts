export interface OhlcData {
	timestamp: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number | null;
}

export type Interval = "15m" | "1h" | "1d";
