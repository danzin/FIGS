import { AppStoreRankScraper } from "./scrapers/AppStoreRankScraper";
// A mock message broker that just logs to console
const mockBroker = {
	publish: async (exchange: string, key: string, msg: any) => {
		console.log(`MOCK PUBLISH to ${exchange}:`, msg);
	},
} as any;

async function test() {
	const scraper = new AppStoreRankScraper(
		"coinbase", // Internal name for your system
		"Coinbase: Buy BTC, ETH, SOL", // Exact display name to search for
		"us", // Country
		"36" // Finance category ID
	);
	const scheduler = { publishResult: mockBroker.publish }; // Mock the scheduler's publish method

	try {
		const result = await scraper.scrape();
		console.log("Publishing indicator:", JSON.stringify(result, null, 2));
		const indicator = {
			name: result?.name,
			time: result?.time,
			value: result?.value,
			source: result?.source,
		};
		await scheduler.publishResult(indicator);
	} catch (e) {
		console.error("Test failed");
	}
}
test();
