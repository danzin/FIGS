export interface OhlcData {
	timestamp: string; // The API sends the date as an ISO string
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number | null; // Volume can be null
}
