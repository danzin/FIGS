"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TickerService = void 0;
const CoinGeckoMarketDataSource_1 = require("../../datasources/CoinGeckoMarketDataSource");
class TickerService {
    constructor(schedulerManager) {
        this.schedulerManager = schedulerManager;
    }
    async addTicker(request) {
        // Validate request
        if (!request.coinId || !request.metric) {
            return {
                success: false,
                error: "coinId and metric are required",
                message: "Invalid request parameters",
            };
        }
        const validMetrics = ["price", "market_cap", "volume", "dominance"];
        if (!validMetrics.includes(request.metric)) {
            return {
                success: false,
                error: `Invalid metric. Supported metrics: ${validMetrics.join(", ")}`,
                message: "Invalid metric specified",
            };
        }
        // Special validation for dominance metric
        if (request.metric === "dominance" && request.coinId !== "bitcoin") {
            return {
                success: false,
                error: "Dominance metric is only supported for bitcoin",
                message: "Invalid metric for specified coin",
            };
        }
        try {
            // Create data source
            const source = new CoinGeckoMarketDataSource_1.CoinGeckoSource(request.coinId, request.metric);
            // Test if the coin exists and returns data
            console.log(`[TickerService] Testing ${request.coinId} ${request.metric}...`);
            const testSignal = await source.fetch();
            if (!testSignal) {
                return {
                    success: false,
                    error: `No data returned for ${request.coinId} with metric ${request.metric}`,
                    message: "Coin validation failed",
                };
            }
            // Check if source already exists
            const existingStatus = this.schedulerManager.getScheduler().getStatus();
            if (existingStatus.some((s) => s.sourceKey === source.key)) {
                return {
                    success: false,
                    error: `Ticker ${source.key} already exists`,
                    message: "Duplicate ticker",
                    sourceKey: source.key,
                };
            }
            // Add to scheduler with custom or default configuration
            const schedule = request.schedule || "*/15 * * * *";
            const priority = request.priority || "medium";
            const maxRetries = request.maxRetries || 3;
            const retryDelay = request.retryDelay || 60000;
            this.schedulerManager.addCustomSchedule(source, schedule, {
                priority,
                maxRetries,
                retryDelay,
            });
            console.log(`[TickerService] Added ticker: ${source.key} with schedule: ${schedule}`);
            return {
                success: true,
                message: `Successfully added ticker for ${request.coinId} ${request.metric}`,
                sourceKey: source.key,
                schedule,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[TickerService] Error adding ticker ${request.coinId}:`, errorMessage);
            return {
                success: false,
                error: errorMessage,
                message: "Failed to add ticker",
            };
        }
    }
    removeTicker(sourceKey) {
        try {
            this.schedulerManager.getScheduler().unregisterSource(sourceKey);
            return {
                success: true,
                message: `Removed ticker ${sourceKey}`,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: "Failed to remove ticker",
                error: errorMessage,
            };
        }
    }
    listTickers() {
        const status = this.schedulerManager.getScheduler().getStatus();
        const cryptoTickers = status.filter((s) => s.sourceKey.startsWith("coingecko_"));
        return {
            total: cryptoTickers.length,
            tickers: cryptoTickers.map((ticker) => ({
                sourceKey: ticker.sourceKey,
                enabled: ticker.enabled,
                schedule: ticker.schedule,
                lastSuccess: ticker.lastSuccess,
                consecutiveFailures: ticker.consecutiveFailures,
                isHealthy: ticker.isHealthy,
            })),
        };
    }
    async validateCoin(coinId) {
        try {
            const testSource = new CoinGeckoMarketDataSource_1.CoinGeckoSource(coinId, "price");
            const signal = await testSource.fetch();
            if (signal) {
                return {
                    valid: true,
                    coinId,
                    message: `${coinId} is supported and returning data`,
                    sampleValue: signal.value,
                };
            }
            else {
                return {
                    valid: false,
                    coinId,
                    message: `${coinId} returned no data`,
                };
            }
        }
        catch (error) {
            return {
                valid: false,
                coinId,
                message: `Error validating ${coinId}: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
exports.TickerService = TickerService;
//# sourceMappingURL=TickerService.js.map