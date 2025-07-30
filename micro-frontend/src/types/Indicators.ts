export interface IndicatorData {
	name: string;
	value: number;
	timestamp: string;
	source: string;
	change_24h?: number; // Optional, for metrics that have a 24h change
}
