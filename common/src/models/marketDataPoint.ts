export interface MarketDataPoint {
	time: Date;
	asset_symbol: string; // e.g., 'bitcoin', 'ethereum'
	type: "price" | "volume" | "tvl" | "active_addresses" | "price_historical";
	value: number;
	source: string;
}
