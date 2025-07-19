import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { config } from "./utils/config";
import { ScrapeScheduler } from "./scheduler/ScrapeScheduler";

import { AppStoreRankScraper } from "./scrapers/AppStoreRankScraper";

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

		this.scheduler.schedule(
			new AppStoreRankScraper("coinbase", "id886427730", "us"),
			"0 8 * * *" // Run once a day at 8:00 AM UTC
		);

		console.log("[ScraperApp] All scrapers have been scheduled.");
	}
}

const app = new ScraperApp();
app.start().catch((err) => {
	console.error("[ScraperApp] Fatal error during startup:", err);
	process.exit(1);
});
