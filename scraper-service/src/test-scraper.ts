import { ScraperResult } from "./models/Scraper.interface";
import { AppStoreRankScraper } from "./scrapers/AppStoreRankScraper";
// A mock message broker that just logs to console
async function mockPublishResult(result: ScraperResult): Promise<void> {
	if (!result) {
		console.log("MOCK PUBLISH: Received null, nothing to publish.");
		return;
	}

	const dataPoints = Array.isArray(result) ? result : [result];
	console.log("\n--- MOCK PUBLISH ---");
	for (const point of dataPoints) {
		if ("asset_symbol" in point) {
			console.log("Publishing to exchange: market_data");
			console.log("Message:", point);
		} else if ("name" in point) {
			console.log("Publishing to exchange: market_indicators");
			console.log("Message:", point);
		}
	}
	console.log("--------------------");
}

async function test() {
	const scraper = new AppStoreRankScraper("coinbase", "Coinbase: Buy BTC, ETH, SOL", "us");

	try {
		console.log(`--- Running Scraper Test for: ${scraper.key} ---`);
		const result = await scraper.scrape();

		console.log("\nPublishing result...");
		await mockPublishResult(result); // Call our corrected mock function
	} catch (e) {
		console.error("Test failed:", e);
	} finally {
		console.log("\n--- Scraper Test Finished ---");
	}
}
test();
