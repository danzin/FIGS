import { MacroRawArticle } from "@financialsignalsgatheringsystem/common";

export type MacroChannel =
	| "energy"
	| "monetary_policy"
	| "sanctions_and_geopolitics"
	| "other_macro";

const CHANNEL_KEYWORDS: Record<Exclude<MacroChannel, "other_macro">, string[]> = {
	energy: [
		"strait of hormuz",
		"oil supply",
		"opec",
		"brent",
		"wti",
		"pipeline",
		"shipping disruption",
		"energy crisis",
	],
	monetary_policy: [
		"federal reserve",
		"fed",
		"ecb",
		"bank of england",
		"bank of japan",
		"interest rate",
		"rate hike",
		"rate cut",
		"quantitative tightening",
		"quantitative easing",
	],
	sanctions_and_geopolitics: [
		"sanction",
		"geopolitical",
		"military",
		"conflict",
		"war",
		"ceasefire",
		"trade restriction",
		"export ban",
	],
};

function articleText(article: MacroRawArticle): string {
	return `${article.title || ""} ${article.body || ""}`.toLowerCase();
}

function countMatches(text: string, keywords: string[]): number {
	return keywords.reduce((count, keyword) => {
		return text.includes(keyword) ? count + 1 : count;
	}, 0);
}

export function inferMacroChannel(article: MacroRawArticle): MacroChannel {
	const metadataChannel =
		article.metadata && typeof article.metadata["channel"] === "string"
			? String(article.metadata["channel"])
			: undefined;

	if (metadataChannel === "energy" || metadataChannel === "monetary_policy" || metadataChannel === "sanctions_and_geopolitics") {
		return metadataChannel;
	}

	const text = articleText(article);
	let selected: MacroChannel = "other_macro";
	let maxHits = 0;

	for (const [channel, keywords] of Object.entries(CHANNEL_KEYWORDS) as [Exclude<MacroChannel, "other_macro">, string[]][]) {
		const hits = countMatches(text, keywords);
		if (hits > maxHits) {
			maxHits = hits;
			selected = channel;
		}
	}

	return selected;
}

export function isMacroRelevant(article: MacroRawArticle): boolean {
	return inferMacroChannel(article) !== "other_macro";
}

export function calculateSeverity(article: MacroRawArticle): number {
	const text = articleText(article);
	const allKeywords = Object.values(CHANNEL_KEYWORDS).flat();
	const hitCount = countMatches(text, allKeywords);

	const urgencyTerms = ["emergency", "escalation", "surge", "shock", "crisis"];
	const urgencyBoost = urgencyTerms.some((term) => text.includes(term)) ? 0.15 : 0;

	const base = 0.25;
	const score = base + hitCount * 0.08 + urgencyBoost;
	return Math.max(0.1, Math.min(0.95, Number(score.toFixed(3))));
}

