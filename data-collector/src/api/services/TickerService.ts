import { SchedulerConfigManager } from "../../SchedulerConfigManager";
import { CoinGeckoMarketDataSource } from "../../datasources/CoinGeckoMarketDataSource";
import { CoinGeckoIndicatorSource } from "../../datasources/CoinGeckoIndicatorSource";
import { AddTickerRequest, AddTickerResponse, TickerListResponse, ValidationResponse } from "../types/ticker.types";
export class TickerService {
	constructor(private schedulerManager: SchedulerConfigManager) {}

	async addTicker(request: AddTickerRequest): Promise<AddTickerResponse> {
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
			const marketDataSource = new CoinGeckoMarketDataSource(request.coinId);
			console.log(`[TickerService] Testing market data for ${request.coinId}...`);
			const testData = await marketDataSource.fetch();
			if (!testData || testData.length === 0) {
				return {
					success: false,
					error: `No data returned for ${request.coinId} with metric ${request.metric}`,
					message: "Coin validation failed",
				};
			}

			// Check if source already exists
			const existingStatus = this.schedulerManager.getScheduler().getStatus();
			if (existingStatus.some((s) => s.sourceKey === marketDataSource.key)) {
				return {
					success: false,
					error: `Ticker ${marketDataSource.key} already exists`,
					message: "Duplicate ticker",
					sourceKey: marketDataSource.key,
				};
			}

			// Add to scheduler with custom or default configuration
			const schedule = request.schedule || "*/15 * * * *";
			const commonOptions = {
				priority: request.priority || "medium",
				maxRetries: request.maxRetries || 3,
				retryDelay: request.retryDelay || 60000,
			};

			this.schedulerManager.addCustomSchedule(marketDataSource, schedule, commonOptions);
			console.log(`[TickerService] Added market data source: ${marketDataSource.key} with schedule: ${schedule}`);

			if (request.coinId === "bitcoin") {
				const dominanceSource = new CoinGeckoIndicatorSource("btc_dominance");
				if (!existingStatus.some((s) => s.sourceKey === dominanceSource.key)) {
					this.schedulerManager.addCustomSchedule(
						dominanceSource,
						"0 */2 * * *", // Dominance doesn't change fast, every 2 hours is fine
						{ ...commonOptions, priority: "low" }
					);
					console.log(`[TickerService] Added indicator source: ${dominanceSource.key}`);
				}
			}

			return {
				success: true,
				message: `Successfully added ticker for ${request.coinId} ${request.metric}`,
				sourceKey: marketDataSource.key,
				schedule,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`[TickerService] Error adding ticker ${request.coinId}:`, errorMessage);

			return {
				success: false,
				error: errorMessage,
				message: "Failed to add ticker",
			};
		}
	}

	removeTicker(sourceKey: string): { success: boolean; message: string; error?: string } {
		try {
			this.schedulerManager.getScheduler().unregisterSource(sourceKey);
			return {
				success: true,
				message: `Removed ticker ${sourceKey}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				message: "Failed to remove ticker",
				error: errorMessage,
			};
		}
	}

	listTickers(): TickerListResponse {
		const status = this.schedulerManager.getScheduler().getStatus();

		// Group sources by asset symbol
		const assets: Record<string, any[]> = {};
		for (const s of status) {
			let assetSymbol = s.sourceKey;
			// A simple way to group by asset name
			if (s.sourceKey.startsWith("coingecko_market_data_")) {
				assetSymbol = s.sourceKey.replace("coingecko_market_data_", "");
			} // Add more rules for other sources...

			if (!assets[assetSymbol]) {
				assets[assetSymbol] = [];
			}
			assets[assetSymbol].push(s);
		}
		const marketDataTickers = status.filter((s) => s.sourceKey.startsWith("coingecko_market_data_"));
		return {
			total: marketDataTickers.length,
			tickers: marketDataTickers.map((ticker) => ({
				sourceKey: ticker.sourceKey,
				asset: ticker.sourceKey.replace("coingecko_market_data_", ""),
				enabled: ticker.enabled,
				schedule: ticker.schedule,
				lastSuccess: ticker.lastSuccess,
				consecutiveFailures: ticker.consecutiveFailures,
				isHealthy: ticker.isHealthy,
			})),
		};
	}

	async validateCoin(coinId: string): Promise<ValidationResponse> {
		try {
			const testSource = new CoinGeckoMarketDataSource(coinId);
			const dataPoints = await testSource.fetch();

			if (dataPoints && dataPoints.length > 0) {
				return {
					valid: true,
					coinId,
					message: `${coinId} is supported and returning data`,
					sampleValue: dataPoints.find((p) => p.type === "price")?.value || 0,
				};
			} else {
				return {
					valid: false,
					coinId,
					message: `${coinId} returned no data`,
				};
			}
		} catch (error) {
			return {
				valid: false,
				coinId,
				message: `Error validating ${coinId}: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * The api for CoinGecko's available coins is https://api.coingecko.com/api/v3/coins/list
	 * It returns all coins in the format:
	 *  `0	{ id: "_", symbol: "gib", name: "༼ つ ◕_◕ ༽つ" }, 1	{ id: "000-capital", symbol: "000", name: "000 Capital" }...`
	 * There are over 17100 as of now. I'll need something to keep them in, return them quickly and in some sort of sensible manner
	 * because I can't just return 17k+ results.
	 * I also can't request the whole list and filter through over 17k results every single time.
	 * Plus, the whole list is irrelevant anyways. Every new pumpfun shitter gets added daily.
	 * Now that I think about it, no way I'm wasting bandwidth and memory on "1-Sol-And-A-Dream", "Sydney, Truth Terminal's Girlfriend",
	 * { id: "truth-terminal-s-hentai", symbol: "hentai", name: "Truth Terminal's Hentai" } or any other past, current and future rug.
	 *
	 * Will probably use Redis and keep track of and support top coins in categories and mcap.
	 * This whole thing needs to stay small and compact for the time being.
	 */
	// getSupportedOptions() {
	// ....
	// 	return {
	// 		supportedMetrics: ["price", "market_cap", "volume", "dominance"],
	// 		popularCoins: supportedCoins,
	// 		note: "You can use any coin ID from CoinGecko API. Use /tickers/validate/{coinId} to check if a coin is supported.",
	// 	};
	// }
}
