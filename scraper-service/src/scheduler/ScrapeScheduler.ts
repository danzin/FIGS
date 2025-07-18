import cron from "node-cron";
import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { Scraper, ScraperResult } from "../models/Scraper.interface";

export class ScrapeScheduler {
	constructor(private messageBroker: RabbitMQService) {}

	public schedule(scraper: Scraper, cronExpression: string): void {
		console.log(`[ScrapeScheduler] Scheduling scraper "${scraper.key}" with schedule: ${cronExpression}`);
		cron.schedule(cronExpression, async () => {
			console.log(`[ScrapeScheduler] Triggering scraper: "${scraper.key}"`);
			try {
				const result = await scraper.scrape();
				await this.publishResult(result);
				console.log(`[ScrapeScheduler] Successfully ran and published result for "${scraper.key}"`);
			} catch (error) {
				console.error(`[ScrapeScheduler] Scraper "${scraper.key}" failed:`, error);
			}
		});
	}

	private async publishResult(result: ScraperResult): Promise<void> {
		if (!result) return;

		const dataPoints = Array.isArray(result) ? result : [result];
		for (const point of dataPoints) {
			if ("asset_symbol" in point) {
				await this.messageBroker.publish("market_data", "", point);
			} else if ("name" in point) {
				await this.messageBroker.publish("market_indicators", "", point);
			}
		}
	}
}
