import Parser from "rss-parser";
import { DataSource, NewsArticle } from "@financialsignalsgatheringsystem/common";

const parser = new Parser();

export class CryptoSlateSource implements DataSource {
	key = "cryptoslate-latest";

	async fetch(): Promise<NewsArticle[] | null> {
		const feed = await parser.parseURL("https://cryptoslate.com/feed/");
		if (!feed.items?.length) return null;

		// top 5 items
		return feed.items.slice(0, 5).map((item) => ({
			id: item.guid || item.link!,
			source: "CryptoSlate",
			title: item.title || "No title",
			url: item.link!,
			publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
		}));
	}
}
