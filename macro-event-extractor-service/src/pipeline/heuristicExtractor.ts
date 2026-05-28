import { randomUUID } from "crypto";
import { MacroEvent, MacroRawArticle } from "@financialsignalsgatheringsystem/common";
import { calculateSeverity, inferMacroChannel, MacroChannel } from "./keywordFilter";
import { extractRegion, inferAffectedAssets } from "./entityNormalizer";

interface ExtractorOptions {
	model: string;
	version: string;
}

function inferEventType(article: MacroRawArticle, channel: MacroChannel): string {
	const text = `${article.title || ""} ${article.body || ""}`.toLowerCase();

	if (channel === "energy") {
		if (text.includes("hormuz") || text.includes("shipping")) return "shipping_disruption";
		if (text.includes("opec")) return "oil_production_decision";
		return "oil_supply_shock";
	}

	if (channel === "monetary_policy") {
		if (text.includes("rate hike")) return "policy_tightening";
		if (text.includes("rate cut")) return "policy_easing";
		return "monetary_policy_update";
	}

	if (channel === "sanctions_and_geopolitics") {
		if (text.includes("sanction")) return "sanctions_update";
		return "geopolitical_risk_event";
	}

	return "macro_event";
}

export async function extractMacroEvent(
	article: MacroRawArticle,
	options: ExtractorOptions
): Promise<MacroEvent> {
	const channel = inferMacroChannel(article);
	const severity = calculateSeverity(article);
	const eventTime = article.published_at || article.fetched_at;
	const eventType = inferEventType(article, channel);
	const canonicalText = article.title || article.body || "Macro event";
	const confidence = Number(Math.min(0.95, 0.5 + severity / 2).toFixed(3));

	return {
		id: randomUUID(),
		raw_article_id: undefined,
		event_time: eventTime,
		event_type: eventType,
		channel,
		severity,
		region: extractRegion(article),
		country_codes: [],
		affected_assets: inferAffectedAssets(channel),
		canonical_text: canonicalText,
		extraction_model: options.model,
		extraction_version: options.version,
		confidence,
		metadata: {
			extraction_mode: "heuristic_stub",
			source_url: article.url || null,
		},
	};
}

