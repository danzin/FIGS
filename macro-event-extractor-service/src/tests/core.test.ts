import assert from "node:assert/strict";
import { MacroRawArticle } from "@financialsignalsgatheringsystem/common";
import { RecentHashDedupe } from "../pipeline/dedupe";
import { extractRegion, inferAffectedAssets, normalizeMacroArticle } from "../pipeline/entityNormalizer";
import { inferMacroChannel, isMacroRelevant, calculateSeverity } from "../pipeline/keywordFilter";
import { extractMacroEvent } from "../pipeline/heuristicExtractor";

type TestCase = {
	name: string;
	run: () => void | Promise<void>;
};

function baseArticle(overrides: Partial<MacroRawArticle> = {}): MacroRawArticle {
	return {
		id: "test-article-id",
		source: "Test Source",
		title: "Test title",
		body: "Test body",
		published_at: new Date("2026-01-01T00:00:00.000Z"),
		fetched_at: new Date("2026-01-01T00:05:00.000Z"),
		content_hash: "hash-1",
		...overrides,
	};
}

const tests: TestCase[] = [
	{
		name: "inferMacroChannel honors explicit metadata channel",
		run: () => {
			const article = baseArticle({
				title: "Completely unrelated topic",
				metadata: { channel: "energy" },
			});
			assert.equal(inferMacroChannel(article), "energy");
		},
	},
	{
		name: "inferMacroChannel detects monetary policy content",
		run: () => {
			const article = baseArticle({
				title: "Federal Reserve signals another rate hike",
				body: "Markets digest central bank policy tightening",
			});
			assert.equal(inferMacroChannel(article), "monetary_policy");
			assert.equal(isMacroRelevant(article), true);
		},
	},
	{
		name: "inferMacroChannel marks irrelevant content as other_macro",
		run: () => {
			const article = baseArticle({
				title: "A random sports update",
				body: "Nothing about macro here",
			});
			assert.equal(inferMacroChannel(article), "other_macro");
			assert.equal(isMacroRelevant(article), false);
		},
	},
	{
		name: "calculateSeverity applies urgency boost and upper bound",
		run: () => {
			const medium = calculateSeverity(
				baseArticle({
					title: "OPEC discusses production targets",
					body: "Brent futures react",
				})
			);
			const urgent = calculateSeverity(
				baseArticle({
					title: "Emergency escalation in Strait of Hormuz energy crisis shock",
					body: "Oil supply shock and shipping disruption trigger surge",
				})
			);

			assert.ok(urgent > medium, "urgency score should be higher");
			assert.ok(urgent <= 0.95, "severity should be capped to 0.95");
			assert.ok(urgent >= 0.1, "severity should be floored to 0.1");
		},
	},
	{
		name: "normalizeMacroArticle trims and defaults language/source",
		run: () => {
			const normalized = normalizeMacroArticle(
				baseArticle({
					source: "  Reuters   ",
					title: "  Fed meeting  notes ",
					body: "   Policy    update ",
					language: "   ",
				})
			);

			assert.equal(normalized.source, "Reuters");
			assert.equal(normalized.title, "Fed meeting notes");
			assert.equal(normalized.body, "Policy update");
			assert.equal(normalized.language, "en");
		},
	},
	{
		name: "extractRegion identifies known geopolitics hints",
		run: () => {
			const article = baseArticle({
				title: "Escalation near Strait of Hormuz raises risks",
			});
			assert.equal(extractRegion(article), "Middle East");
		},
	},
	{
		name: "inferAffectedAssets returns expected channel baskets",
		run: () => {
			assert.deepEqual(inferAffectedAssets("energy"), ["brent", "wti", "btc", "eth"]);
			assert.deepEqual(inferAffectedAssets("monetary_policy"), ["dxy", "us10y", "btc", "eth"]);
			assert.deepEqual(inferAffectedAssets("other_macro"), ["btc", "eth"]);
		},
	},
	{
		name: "RecentHashDedupe evicts oldest hash at capacity",
		run: () => {
			const dedupe = new RecentHashDedupe(2);
			dedupe.remember("a");
			dedupe.remember("b");
			assert.equal(dedupe.has("a"), true);
			assert.equal(dedupe.has("b"), true);

			dedupe.remember("c");
			assert.equal(dedupe.has("a"), false);
			assert.equal(dedupe.has("b"), true);
			assert.equal(dedupe.has("c"), true);
		},
	},
	{
		name: "extractMacroEvent maps energy shipping article into canonical event",
		run: async () => {
			const article = baseArticle({
				title: "Shipping disruption reported in Strait of Hormuz",
				body: "Oil supply shock risks increase amid escalation",
				metadata: { channel: "energy" },
			});

			const event = await extractMacroEvent(article, {
				model: "test-model",
				version: "test-v1",
			});

			assert.equal(event.channel, "energy");
			assert.equal(event.event_type, "shipping_disruption");
			assert.equal(event.extraction_model, "test-model");
			assert.equal(event.extraction_version, "test-v1");
			assert.ok((event.affected_assets || []).includes("brent"));
			assert.ok(event.severity >= 0.1 && event.severity <= 0.95);
			assert.ok(event.confidence >= 0.5 && event.confidence <= 0.95);
		},
	},
];

async function run(): Promise<void> {
	console.log(`Running ${tests.length} macro extractor core tests...`);
	for (const test of tests) {
		try {
			await test.run();
			console.log(`✓ ${test.name}`);
		} catch (error) {
			console.error(`✗ ${test.name}`);
			throw error;
		}
	}
	console.log("All macro extractor core tests passed.");
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});

