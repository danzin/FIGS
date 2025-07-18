import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { config } from "./utils/config";
import { ScrapeScheduler } from "./scheduler/ScrapeScheduler";

// Import your new scraper class
import { AppStoreRankScraper } from "./scrapers/AppStoreRankScraper";
// You would also import others here, e.g., PlayStoreRankScraper

class ScraperApp {
	private messageBroker: RabbitMQService;
	private scheduler: ScrapeScheduler;

	constructor() {
		this.messageBroker = new RabbitMQService(config.RABBITMQ_URL!);
		this.scheduler = new ScrapeScheduler(this.messageBroker);
	}

	public async start(): Promise<void> {
		console.log("[ScraperApp] Starting scraper service...");
		await this.messageBroker.connect();
		console.log("[ScraperApp] Connected to RabbitMQ.");

		// --- Schedule your scraping tasks here ---

		// Schedule Coinbase US App Store Rank scrape
		this.scheduler.schedule(
			new AppStoreRankScraper("coinbase", "us"),
			"0 8 * * *" // Run once a day at 8:00 AM UTC
		);

		// Schedule Binance US App Store Rank scrape (staggered)
		this.scheduler.schedule(
			new AppStoreRankScraper("binance", "us"),
			"5 8 * * *" // Run once a day at 8:05 AM UTC
		);

		// You could easily add more, e.g., for Great Britain
		// this.scheduler.schedule(
		//   new AppStoreRankScraper('coinbase', 'gb'),
		//   '10 8 * * *' // 8:10 AM UTC
		// );

		console.log("[ScraperApp] All scrapers have been scheduled.");
	}
}

const app = new ScraperApp();
app.start().catch((err) => {
	console.error("[ScraperApp] Fatal error during startup:", err);
	process.exit(1);
});
