import { MacroRawArticle } from "@financialsignalsgatheringsystem/common";
import { MacroChannel } from "./keywordFilter";

const REGION_HINTS: Record<string, string> = {
	iran: "Middle East",
	israel: "Middle East",
	hormuz: "Middle East",
	opec: "Global",
	"federal reserve": "United States",
	washington: "United States",
	ecb: "Eurozone",
	"european central bank": "Eurozone",
	china: "Asia",
	russia: "Eastern Europe",
	ukraine: "Eastern Europe",
};

function cleanText(value?: string): string | undefined {
	if (!value) return undefined;
	const normalized = value.replace(/\s+/g, " ").trim();
	return normalized.length > 0 ? normalized : undefined;
}

export function normalizeMacroArticle(article: MacroRawArticle): MacroRawArticle {
	return {
		...article,
		title: cleanText(article.title),
		body: cleanText(article.body),
		source: cleanText(article.source) || "Unknown Source",
		language: cleanText(article.language) || "en",
	};
}

export function extractRegion(article: MacroRawArticle): string | undefined {
	const text = `${article.title || ""} ${article.body || ""}`.toLowerCase();
	for (const [keyword, region] of Object.entries(REGION_HINTS)) {
		if (text.includes(keyword)) return region;
	}
	return undefined;
}

export function inferAffectedAssets(channel: MacroChannel): string[] {
	switch (channel) {
		case "energy":
			return ["brent", "wti", "btc", "eth"];
		case "monetary_policy":
			return ["dxy", "us10y", "btc", "eth"];
		case "sanctions_and_geopolitics":
			return ["brent", "dxy", "btc", "eth"];
		default:
			return ["btc", "eth"];
	}
}

