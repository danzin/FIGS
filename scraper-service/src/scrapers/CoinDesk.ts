import Parser from "rss-parser";
import { DataSource, NewsArticle } from "@financialsignalsgatheringsystem/common";

const parser = new Parser();

export class CoinDeskSource implements DataSource {
	key = "coindesk-latest";

	async fetch(): Promise<NewsArticle[] | null> {
		const feed = await parser.parseURL("https://www.coindesk.com/arc/outboundfeeds/rss/");
		if (!feed.items?.length) return null;

		// the top 5 items only
		return feed.items.slice(0, 5).map((item) => ({
			id: item.guid || item.link!,
			source: "CoinDesk",
			title: item.title || "No title",
			url: item.link!,
			publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
		}));
	}
}
