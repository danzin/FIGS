import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { ScraperConfigManager } from "./scheduler/ScraperConfigManager";
import { config } from "./utils/config";
class ScraperApp {
	private messageBroker: RabbitMQService;
	private scraperManager: ScraperConfigManager;
	// ... other services

	constructor() {
		this.messageBroker = new RabbitMQService(config.RABBITMQ_URL!);
		this.scraperManager = new ScraperConfigManager(this.messageBroker);
		// ... instantiate other services
	}

	public async start(): Promise<void> {
		await this.messageBroker.connect();
		this.scraperManager.setupDefaultSchedules();
		this.scraperManager.getScheduler().start();
		console.log("[ScraperApp] Scraper service started and tasks scheduled.");
		// ... start API, monitor, etc.
	}

	// ... graceful shutdown
}

const app = new ScraperApp();
app.start();
