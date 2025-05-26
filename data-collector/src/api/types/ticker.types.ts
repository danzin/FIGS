export interface AddTickerRequest {
	coinId: string;
	metric: "price" | "market_cap" | "volume" | "dominance";
	schedule?: string; // defaults to "*/15 * * * *"
	priority?: "high" | "medium" | "low"; // defaults to "medium"
	maxRetries?: number; // defaults to 3
	retryDelay?: number; // defaults to 60000ms
}

export interface AddTickerResponse {
	success: boolean;
	message: string;
	sourceKey?: string;
	schedule?: string;
	error?: string;
}

export interface TickerListResponse {
	total: number;
	tickers: Array<{
		sourceKey: string;
		enabled: boolean;
		schedule: string;
		lastSuccess?: Date;
		consecutiveFailures: number;
		isHealthy: boolean;
	}>;
}

export interface ValidationResponse {
	valid: boolean;
	coinId: string;
	message: string;
	sampleValue?: number;
}
