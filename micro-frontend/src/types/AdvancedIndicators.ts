// Power Law Model Types
export interface PowerLawData {
	currentPrice: number;
	fairValue: number;
	drawdown: number;
	daysSinceGenesis: number;
	slope: number;
	intercept: number;
	historicalData: {
		timestamp: string;
		price: number;
		fairValue: number;
	}[];
}

// Stablecoin Liquidity Types
export interface StablecoinLiquidityData {
	totalMarketCap: number;
	marketCapChange24h: number;
	yoyGrowth: number;
	liquidityFlowIndex: number;
	breakdown: {
		name: string;
		symbol: string;
		marketCap: number;
		change24h: number;
	}[];
	historicalData: {
		timestamp: string;
		totalMarketCap: number;
		yoyGrowth: number;
		liquidityFlow: number;
	}[];
}

// Open Interest / Leverage Types
export interface OpenInterestData {
	totalOI: number;
	oiChange30d: number;
	oiChangeYoY: number;
	status: "overheated" | "normal" | "flushed";
	historicalData: {
		timestamp: string;
		openInterest: number;
		change30d: number;
	}[];
}

// Momentum Coalescence Types
export interface MomentumCoalescenceData {
	compositeScore: number;
	components: {
		fastROC: number;
		slowROC: number;
		volumeDelta: number;
		volatilityBias: number;
	};
	signal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
	historicalData: {
		timestamp: string;
		compositeScore: number;
	}[];
}

// MVRV Z-Score Types (God View)
export interface MVRVData {
	mvrvZScore: number;
	currentPrice: number;
	realizedPrice: number;
	sma200Week: number;
	signal: "extreme_undervalued" | "undervalued" | "fair" | "overvalued" | "extreme_overvalued";
	historicalData: {
		timestamp: string;
		price: number;
		realizedPrice: number;
		zScore: number;
	}[];
}

// Hash Rate Data
export interface HashRateData {
	currentHashRate: number;
	hashRateChange30d: number;
	minerCapitulation: boolean;
	ribbonStatus: "recovery" | "neutral" | "capitulation";
	historicalData: {
		timestamp: string;
		hashRate: number;
		sma30: number;
		sma60: number;
	}[];
}

// Composite Indicator
export interface CompositeIndicatorData {
	overallScore: number;
	normalizedScores: {
		rsi: number;
		mvrv: number;
		minerHealth: number;
		liquidityFlow: number;
		momentum: number;
	};
	regime: "bull" | "bear" | "neutral";
	recommendation: string;
}

// CVD (Cumulative Volume Delta)
export interface CVDData {
	currentCVD: number;
	cvdChange24h: number;
	divergence: "bullish" | "bearish" | "none";
	historicalData: {
		timestamp: string;
		cvd: number;
		price: number;
	}[];
}
