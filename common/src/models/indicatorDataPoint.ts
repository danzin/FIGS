export interface IndicatorDataPoint {
	time: Date;
	name: string; // e.g., 'fear_greed_index', 'vix_level'
	value: number;
	source: string;
}
