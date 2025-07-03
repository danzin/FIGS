export interface AddTickerRequest {
    coinId: string;
    metric: "price" | "market_cap" | "volume" | "dominance";
    schedule?: string;
    priority?: "high" | "medium" | "low";
    maxRetries?: number;
    retryDelay?: number;
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
//# sourceMappingURL=ticker.types.d.ts.map