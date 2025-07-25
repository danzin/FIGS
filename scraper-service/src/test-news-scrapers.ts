import { CoinDeskSource } from "./scrapers/CoinDesk";
import { CryptoSlateSource } from "./scrapers/CryptoSlate";
import { NewsArticle } from "@financialsignalsgatheringsystem/common";
async function test(srcName: string, src: { fetch: () => Promise<NewsArticle[] | null> }) {
	console.log(`\n--- ${srcName} ---`);
	const items = await src.fetch();
	if (!items) {
		console.log("No articles fetched");
		return;
	}
	items.forEach((a: NewsArticle) => {
		console.log(`${a.source} | ${a.publishedAt.toISOString()} | ${a.title}`);
		console.log(`-> ${a.url}\n`);
	});
}

async function main() {
	try {
		await test("CoinDesk", new CoinDeskSource());
		await test("CryptoSlate", new CryptoSlateSource());
	} catch (e) {
		console.error("Test failed:", e);
	} finally {
		console.log("\n--- Scraper Test Finished ---");
	}
}

main();
