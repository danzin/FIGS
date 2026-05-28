import Parser from "rss-parser";
import crypto from "crypto";
import {
  DataSource,
  MacroRawArticle,
} from "@financialsignalsgatheringsystem/common";
import { toServiceError } from "../utils/errors";

const parser = new Parser();

export class EnergyChokepointSource implements DataSource {
  key = "energy-chokepoint-news";

  async fetch(): Promise<MacroRawArticle[] | null> {
    const query = encodeURIComponent(
      "strait of hormuz OR oil supply disruption OR OPEC OR energy crisis",
    );
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    try {
      const feed = await parser.parseURL(url);
      if (!feed.items?.length) return null;

      return feed.items.slice(0, 20).map((item) => {
        const title = item.title || "No title";
        const body = item.contentSnippet || item.content || item.summary || "";
        const content_hash = crypto
          .createHash("sha256")
          .update(title + body)
          .digest("hex");

        return {
          id: crypto.randomUUID(),
          source: "Google News - Energy",
          external_id: item.guid || item.link!,
          url: item.link!,
          title,
          body,
          language: "en",
          published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
          fetched_at: new Date(),
          content_hash,
          metadata: {
            channel: "energy",
          },
        };
      });
    } catch (error) {
      throw toServiceError(
        error,
        {
          operation: "fetch",
          service: "scraper-service",
          scraper: this.key,
          feed: "google-news",
          url,
        },
        "Failed to fetch energy chokepoint news feed.",
      );
    }
  }
}
