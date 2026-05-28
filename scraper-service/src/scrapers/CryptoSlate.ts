import Parser from "rss-parser";
import {
  DataSource,
  NewsArticle,
} from "@financialsignalsgatheringsystem/common";
import { toServiceError } from "../utils/errors";

const parser = new Parser();

export class CryptoSlateSource implements DataSource {
  key = "cryptoslate-latest";

  async fetch(): Promise<NewsArticle[] | null> {
    const url = "https://cryptoslate.com/feed/";

    try {
      const feed = await parser.parseURL(url);
      if (!feed.items?.length) return null;

      // top 20 items
      return feed.items.slice(0, 20).map((item) => ({
        id: item.guid || item.link!,
        source: "CryptoSlate",
        title: item.title || "No title",
        url: item.link!,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        summary:
          item.contentSnippet || item.content || item.summary || undefined,
        imageUrl:
          (item.enclosure && "url" in item.enclosure
            ? item.enclosure.url
            : undefined) ||
          ((item as { image?: { url?: string } })?.image?.url ?? undefined),
      }));
    } catch (error) {
      throw toServiceError(
        error,
        {
          operation: "fetch",
          service: "scraper-service",
          scraper: this.key,
          feed: "rss",
          url,
        },
        "Failed to fetch CryptoSlate RSS feed.",
      );
    }
  }
}
