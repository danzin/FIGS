import { FredSource } from "./datasources/fred";
import { CoinGeckoMarketDataSource } from "./datasources/CoinGeckoMarketDataSource";
import { CoinGeckoIndicatorSource } from "./datasources/CoinGeckoIndicatorSource";
import { VIXSource, SPYSource, BrentCrudeOilSource } from "./datasources/yahooFinance";
import { FearGreedSource } from "./datasources/feargreed";
import { EtherscanGasSource } from "./datasources/EtherscanGasSource";
import { GitHubActivitySource } from "./datasources/GitHubActivitySource";
import {
	BitcoinNetworkSource,
	EthereumNetworkSource,
	SolanaNetworkSource,
} from "./datasources/BlockchainNetworkSource";
import { DefiLlamaStablecoinSource, StablecoinBreakdownSource } from "./datasources/DefiLlamaSource";
import { CoinGeckoDerivativesSource } from "./datasources/OpenInterestSource";
import { HashRateExtendedSource, MiningDifficultySource } from "./datasources/HashRateSource";
import { PowerLawIndicatorSource } from "./datasources/PowerLawSource";
import { MessageBroker } from "@financialsignalsgatheringsystem/common";
import { DataSource } from "@financialsignalsgatheringsystem/common";
import { config } from "./utils/config";
import { datapoints } from "./utils/datapoints";
import { TaskScheduler, ScheduledDataSource } from "@financialsignalsgatheringsystem/common";
export class SchedulerConfigManager {
	private scheduler: TaskScheduler;

	constructor(messageBroker: MessageBroker) {
		this.scheduler = new TaskScheduler(messageBroker);
	}

	public setupDefaultSchedules(): void {
		// HIGH FREQUENCY - testing different frequencies.
		this.registerHighFrequencySource(
			new CoinGeckoMarketDataSource("bitcoin"),
			"*/15 * * * *", // Every 15 minutes
			{ maxRetries: 2, retryDelay: 30000 }
		);

		this.registerHighFrequencySource(new CoinGeckoMarketDataSource("ethereum"), "*/15 * * * *", {
			maxRetries: 2,
			retryDelay: 30000,
		});
		this.registerHighFrequencySource(new CoinGeckoMarketDataSource("solana"), "*/15 * * * *", {
			maxRetries: 2,
			retryDelay: 30000,
		});

		// Fear & Greed (updates daily but check more frequently for immediate updates)
		this.registerHighFrequencySource(
			new FearGreedSource(),
			"*/15 * * * *", // Every 15 minutes
			{ maxRetries: 3, retryDelay: 60000 }
		);

		// MEDIUM FREQUENCY -  1 hour
		// Market indices and volatility (market hours sensitive)
		//registerMediumFrequencySource Registers them for the long term!!!!!!

		this.registerMediumFrequencySource(new VIXSource(), "0 * * * *", { maxRetries: 3, retryDelay: 60000 });
		this.registerMediumFrequencySource(new SPYSource(), "0 * * * *", { maxRetries: 3, retryDelay: 60000 });
		this.registerMediumFrequencySource(new BrentCrudeOilSource(), "0 * * * *", { maxRetries: 3, retryDelay: 60000 });
		// Bitcoin dominance (changes slowly but important)
		this.registerMediumFrequencySource(
			new CoinGeckoIndicatorSource("btc_dominance"),
			"0 */2 * * *", // Every 2 hours
			{ maxRetries: 2, retryDelay: 120000 }
		);

		// Trading volumes (hourly is sufficient)
		this.registerMediumFrequencySource(new CoinGeckoIndicatorSource("btc_volume"), "0 */1 * * *", {
			maxRetries: 2,
			retryDelay: 120000,
		});

		// =====================================
		// GAS PRICES - Network Congestion Monitoring
		// =====================================

		// Ethereum gas from Etherscan (every 5 minutes)
		this.registerHighFrequencySource(new EtherscanGasSource(config.ETHERSCAN_API_KEY), "*/5 * * * *", {
			maxRetries: 2,
			retryDelay: 30000,
		});

		// =====================================
		// BLOCKCHAIN NETWORK METRICS
		// =====================================

		// Bitcoin network (daily transactions, hash rate, mempool)
		this.registerMediumFrequencySource(
			new BitcoinNetworkSource(),
			"0 */2 * * *", // Every 2 hours
			{ maxRetries: 3, retryDelay: 120000 }
		);

		// Ethereum network metrics
		this.registerMediumFrequencySource(
			new EthereumNetworkSource(config.ETHERSCAN_API_KEY),
			"0 */2 * * *", // Every 2 hours
			{ maxRetries: 3, retryDelay: 120000 }
		);

		// Solana network (priority fees, epoch info)
		this.registerMediumFrequencySource(
			new SolanaNetworkSource(),
			"0 */1 * * *", // Every hour
			{ maxRetries: 3, retryDelay: 120000 }
		);

		// =====================================
		// DEVELOPER ACTIVITY - GitHub
		// =====================================

		// Core blockchain repos activity (daily - data is weekly anyway)
		this.registerLowFrequencySource(
			new GitHubActivitySource(undefined, config.GITHUB_TOKEN),
			"0 8 * * *", // 8 AM UTC daily
			{ maxRetries: 3, retryDelay: 300000 }
		);

		// LOW FREQUENCY - Daily or less frequent
		// FRED data (M2 Money Supply - monthly updates, check daily)
		this.registerLowFrequencySource(
			new FredSource(config.FRED_API_KEY!, datapoints.get("M2") as string), // M2 Money supply
			"0 9 * * *", // 9 AM UTC daily
			{ maxRetries: 5, retryDelay: 300000 }
		);

		this.registerLowFrequencySource(
			new FredSource(config.FRED_API_KEY!, datapoints.get("CPI") as string), // Consumer Price Index
			"0 9 * * *", // 9 AM UTC daily
			{ maxRetries: 5, retryDelay: 300000 }
		);

		this.registerLowFrequencySource(
			new FredSource(config.FRED_API_KEY!, datapoints.get("FEDFUNDS") as string), // Fed Funds Rate
			"0 9 * * *", // 9 AM UTC daily
			{ maxRetries: 5, retryDelay: 300000 }
		);

		this.registerLowFrequencySource(
			new FredSource(config.FRED_API_KEY!, datapoints.get("RRP") as string), // Overnight RRP
			"0 9 * * *", // 9 AM UTC daily
			{ maxRetries: 5, retryDelay: 300000 }
		);

		// More FRED economic indicators
		// this.registerLowFrequencySource(
		// 	new FredSource(config.FRED_API_KEY!, datapoints.get("DG") as string), // 10-Year Treasury
		// 	"0 9 * * *",
		// 	{ maxRetries: 5, retryDelay: 300000 }
		// );

		this.registerLowFrequencySource(
			new FredSource(config.FRED_API_KEY!, datapoints.get("UNR") as string), // Unemployment Rate
			"0 9 * * 1", // Monday 9 AM UTC (weekly check)
			{ maxRetries: 5, retryDelay: 300000 }
		);

		// =====================================
		// ADVANCED INDICATORS - New Sources
		// =====================================

		// Stablecoin liquidity (DefiLlama - updates daily)
		this.registerMediumFrequencySource(
			new DefiLlamaStablecoinSource(),
			"0 */4 * * *", // Every 4 hours
			{ maxRetries: 3, retryDelay: 120000 }
		);

		// Stablecoin breakdown (USDT, USDC, DAI, FDUSD)
		this.registerLowFrequencySource(
			new StablecoinBreakdownSource(),
			"0 */6 * * *", // Every 6 hours
			{ maxRetries: 3, retryDelay: 120000 }
		);

		// CoinGecko Derivatives - aggregate OI from /derivatives endpoint
		// Runs every 6 hours to avoid rate limits on CoinGecko free tier
		// This is the primary OI source - aggregates BTC, ETH, SOL OI from all exchanges
		this.registerLowFrequencySource(
			new CoinGeckoDerivativesSource(),
			"0 */6 * * *", // Every 6 hours (0:00, 6:00, 12:00, 18:00 UTC)
			{ maxRetries: 3, retryDelay: 300000 } // 5 min retry delay
		);

		// Extended hash rate data for ribbon indicator
		this.registerMediumFrequencySource(
			new HashRateExtendedSource(),
			"0 */4 * * *", // Every 4 hours
			{ maxRetries: 3, retryDelay: 120000 }
		);

		// Mining difficulty
		this.registerLowFrequencySource(
			new MiningDifficultySource(),
			"0 */6 * * *", // Every 6 hours (difficulty changes ~every 2 weeks)
			{ maxRetries: 3, retryDelay: 120000 }
		);

		// Power Law and MVRV calculations
		this.registerLowFrequencySource(
			new PowerLawIndicatorSource(),
			"0 */4 * * *", // Every 4 hours
			{ maxRetries: 3, retryDelay: 180000 }
		);
	}

	public setupMarketHoursAwareSchedules(): void {
		// Advanced scheduling for trad-fi that considers market hours US Market Hours

		// During US market hours - more frequent traditional asset monitoring
		this.scheduler.registerSource({
			source: new VIXSource(),
			schedule: "*/10 14-21 * * 1-5", // Every 10 minutes during US market hours, weekdays only
			enabled: true,
			priority: "high",
			maxRetries: 2,
			retryDelay: 30000,
			consecutiveFailures: 0,
		});

		this.scheduler.registerSource({
			source: new SPYSource(),
			schedule: "*/10 14-21 * * 1-5", // Every 10 minutes during US market hours
			enabled: true,
			priority: "high",
			maxRetries: 2,
			retryDelay: 30000,
			consecutiveFailures: 0,
		});

		// Outside market hours - less frequent monitoring
		this.scheduler.registerSource({
			source: new VIXSource(),
			schedule: "0 */2 0-13,22-23 * * *", // Every 2 hours outside market hours
			enabled: true,
			priority: "medium",
			maxRetries: 3,
			retryDelay: 120000,
			consecutiveFailures: 0,
		});
	}

	public addCustomSchedule(source: DataSource, cronExpression: string, options: Partial<ScheduledDataSource> = {}): void {
		this.scheduler.registerSource({
			source,
			schedule: cronExpression,
			enabled: true,
			priority: "medium",
			maxRetries: 3,
			retryDelay: 60000,
			consecutiveFailures: 0,
			...options,
		});
	}

	public getScheduler(): TaskScheduler {
		return this.scheduler;
	}

	private registerHighFrequencySource(
		source: DataSource,
		schedule: string,
		options: { maxRetries: number; retryDelay: number }
	): void {
		this.scheduler.registerSource({
			source,
			schedule,
			enabled: true,
			priority: "high",
			maxRetries: options.maxRetries,
			retryDelay: options.retryDelay,
			consecutiveFailures: 0,
		});
	}

	private registerMediumFrequencySource(
		source: DataSource,
		schedule: string,
		options: { maxRetries: number; retryDelay: number }
	): void {
		this.scheduler.registerSource({
			source,
			schedule,
			enabled: true,
			priority: "medium",
			maxRetries: options.maxRetries,
			retryDelay: options.retryDelay,
			consecutiveFailures: 0,
		});
	}

	private registerLowFrequencySource(
		source: DataSource,
		schedule: string,
		options: { maxRetries: number; retryDelay: number }
	): void {
		this.scheduler.registerSource({
			source,
			schedule,
			enabled: true,
			priority: "low",
			maxRetries: options.maxRetries,
			retryDelay: options.retryDelay,
			consecutiveFailures: 0,
		});
	}
}

export const CRON_EXAMPLES = {
	// Every X minutes
	EVERY_5_MIN: "*/5 * * * *",
	EVERY_10_MIN: "*/10 * * * *",
	EVERY_15_MIN: "*/15 * * * *",
	EVERY_30_MIN: "*/30 * * * *",

	// Hourly
	EVERY_HOUR: "0 * * * *",
	EVERY_2_HOURS: "0 */2 * * *",
	EVERY_4_HOURS: "0 */4 * * *",

	// Daily
	DAILY_9AM_UTC: "0 9 * * *",
	DAILY_MIDNIGHT_UTC: "0 0 * * *",

	// Weekdays only
	WEEKDAYS_9AM: "0 9 * * 1-5",

	// Market hours (US: 14:30-21:00 UTC, weekdays)
	US_MARKET_HOURS_15MIN: "*/15 14-21 * * 1-5",
	US_MARKET_HOURS_30MIN: "*/30 14-21 * * 1-5",

	// Weekly
	WEEKLY_MONDAY_9AM: "0 9 * * 1",

	// Monthly (first day of month)
	MONTHLY_FIRST_9AM: "0 9 1 * *",
};
