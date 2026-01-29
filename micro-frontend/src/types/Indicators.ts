export interface IndicatorData {
	name: string;
	value: number;
	timestamp: string;
	source: string;
	change_24h?: number;
}

export interface IndicatorDataPoint {
	timestamp: string;
	value: number;
	name?: string;
}

export interface CorrelationData {
	assets: string[];
	matrix: number[][];
}

export interface RsiData {
	symbol: string;
	name: string;
	rsi: number;
	price: number;
	priceChange24h: number;
}

export interface VolatilityState {
	status: "squeeze" | "expanding" | "neutral";
	bandWidth: number;
	bandWidthPercentile: number;
	upperBand: number;
	lowerBand: number;
	currentPrice: number;
}

export interface MarketHeartbeatData {
	btcDominance?: { value: number; change: number | null };
	ethGas?: { value: number; status: "low" | "medium" | "high" };
	totalMarketCap?: { value: number; change: number | null };
	btcPrice?: { value: number; change: number | null };
	ethPrice?: { value: number; change: number | null };
	solPrice?: { value: number; change: number | null };
	fearGreed?: { value: number; label: string };
}
