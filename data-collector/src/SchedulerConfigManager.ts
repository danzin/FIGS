import { SignalScheduler, ScheduledDataSource } from "./SignalScheduler";
import { FredSource } from "./datasources/fred";
import { CoinGeckoSource } from "./datasources/coingecko";
import { VIXSource, SPYSource } from "./datasources/yahooFinance";
import { FearGreedSource } from "./datasources/feargreed";
import { MessageBroker } from "@financialsignalsgatheringsystem/common";
import { config } from "./utils/config";
import { datapoints } from "./utils/datapoints";
import { ApiNinjasCommoditySource } from "./datasources/apiNinjasCommodity";

export class SchedulerConfigManager {
	private scheduler: SignalScheduler;

	constructor(messageBroker: MessageBroker) {
		this.scheduler = new SignalScheduler(messageBroker);
	}

	public setupDefaultSchedules(): void {
		// HIGH FREQUENCY - testing different frequencies.
		this.registerHighFrequencySource(
			new CoinGeckoSource("bitcoin", "price"),
			"*/15 * * * *", // Every 15 minutes
			{ maxRetries: 2, retryDelay: 30000 }
		);

		this.registerHighFrequencySource(new CoinGeckoSource("ethereum", "price"), "*/15 * * * *", {
			maxRetries: 2,
			retryDelay: 30000,
		});
		this.registerHighFrequencySource(new CoinGeckoSource("solana", "price"), "*/15 * * * *", {
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

		if (config.API_NINJAS_KEY) {
			this.registerMediumFrequencySource(
				new ApiNinjasCommoditySource(config.API_NINJAS_KEY, "oil"),
				"0 * * * *", // Top of every hour
				{ maxRetries: 3, retryDelay: 60000 }
			);
		} else {
			console.warn(
				"[SchedulerConfigManager] API_NINJAS_KEY not found in environment. Skipping commodity price sources."
			);
		}
		this.registerMediumFrequencySource(new VIXSource(), "0 * * * *", { maxRetries: 3, retryDelay: 60000 });

		this.registerMediumFrequencySource(new SPYSource(), "0 * * * *", { maxRetries: 3, retryDelay: 60000 });

		// Bitcoin dominance (changes slowly but important)
		this.registerMediumFrequencySource(
			new CoinGeckoSource("bitcoin", "dominance"),
			"0 */2 * * *", // Every 2 hours
			{ maxRetries: 2, retryDelay: 120000 }
		);

		// Trading volumes (hourly is sufficient)
		this.registerMediumFrequencySource(new CoinGeckoSource("bitcoin", "volume"), "0 */1 * * *", {
			maxRetries: 2,
			retryDelay: 120000,
		});

		// LOW FREQUENCY - Daily or less frequent
		// FRED data (M2 Money Supply - monthly updates, check daily)
		this.registerLowFrequencySource(
			new FredSource(config.FRED_API_KEY!, datapoints.get("M2") as string), // M2 Money supply
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

	public addCustomSchedule(source: any, cronExpression: string, options: Partial<ScheduledDataSource> = {}): void {
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

	public getScheduler(): SignalScheduler {
		return this.scheduler;
	}

	private registerHighFrequencySource(
		source: any,
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
		source: any,
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
		source: any,
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
