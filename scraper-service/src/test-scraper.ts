import { AppStoreRankScraper } from "./scrapers/AppStoreRankScraper";
// A mock message broker that just logs to console
const mockBroker = {
	publish: async (exchange: string, key: string, msg: any) => {
		console.log(`MOCK PUBLISH to ${exchange}:`, msg);
	},
} as any;

async function test() {
	const scraper = new AppStoreRankScraper("coinbase", "us");
	const scheduler = { publishResult: mockBroker.publish }; // Mock the scheduler's publish method

	try {
		const result = await scraper.scrape();
		await scheduler.publishResult(result);
	} catch (e) {
		console.error("Test failed");
	}
}
test();
