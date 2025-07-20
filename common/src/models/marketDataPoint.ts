export interface MarketDataPoint {
	time: Date;
	asset_symbol: string; // e.g., 'bitcoin', 'ethereum'
	type: "price" | "volume" | "rank";
	value: number;
	source: string;
}
