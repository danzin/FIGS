import { MessageBroker, TaskScheduler } from "@financialsignalsgatheringsystem/common";
import { AppStoreRankScraper } from "../scrapers/AppStoreRankScraper";
import { CoinDeskSource } from "../scrapers/CoinDesk";
import { CryptoSlateSource } from "../scrapers/CryptoSlate";

export class ScraperConfigManager {
	private scheduler: TaskScheduler;

	constructor(messageBroker: MessageBroker) {
		this.scheduler = new TaskScheduler(messageBroker);
	}

	public setupDefaultSchedules(): void {
		// Your scraper scheduling logic from index.ts moves here
		this.scheduler.registerSource({
			source: new AppStoreRankScraper("coinbase", "Coinbase: Buy BTC, ETH, SOL", "us"),
			schedule: "0 */5 * * *", // Once every 5 hours
			enabled: true,
			priority: "medium",
			maxRetries: 3, // Scrapers are fragile, more retries
			retryDelay: 15 * 60 * 1000, // 15-minute retry delay
			consecutiveFailures: 0,
		});
		this.scheduler.registerSource({
			source: new CoinDeskSource(),
			schedule: "0 */4 * * *", // Once 4 hours
			enabled: true,
			priority: "medium",
			maxRetries: 3, // Scrapers are fragile, more retries
			retryDelay: 15 * 60 * 1000, // 15-minute retry delay
			consecutiveFailures: 0,
		});
		this.scheduler.registerSource({
			source: new CryptoSlateSource(),
			schedule: "0 */4 * * *", // Once 4 hours
			enabled: true,
			priority: "medium",
			maxRetries: 3, // Scrapers are fragile, more retries
			retryDelay: 15 * 60 * 1000, // 15-minute retry delay
			consecutiveFailures: 0,
		});
	}

	public getScheduler(): TaskScheduler {
		return this.scheduler;
	}
}
