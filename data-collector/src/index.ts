import cron from "node-cron";

import { Gatherer } from "./gatherer";
import { FredSource } from "./datasources/fred";
import { config } from "./utils/config";
import { datapoints } from "./utils/datapoints";
import { RabbitMQService } from "./services/RabbitMQService";
import { CoinGeckoSource } from "./datasources/coingecko";
import { FearGreedSource } from "./datasources/feargreed";
import { VIXSource } from "./datasources/vixSource";
import { SPYSource } from "./datasources/spySource";

// 1. Validate env
const FRED_API_KEY = config.FRED_API_KEY!;
const RABBITMQ_URL = config.RABBITMQ_URL!;
const CRON_SCHEDULE = config.CRON_SCHEDULE!;

if (!FRED_API_KEY) {
	console.error("[index] Missing one of FRED_API_KEY, RABBITMQ_URL or CRON_SCHEDULE");
	process.exit(1);
}

const rabbitMQService = new RabbitMQService(RABBITMQ_URL); // Create instance
async function setupBroker() {
	await rabbitMQService.connect(); // Connects and creates channel internally
	console.log("[index] RabbitMQService connected.");
}

async function publishSignals() {
	try {
		const sources = [
			new FredSource(FRED_API_KEY!, datapoints.get("FREDM2") as string),
			new CoinGeckoSource("bitcoin", "price"),
			new CoinGeckoSource("bitcoin", "dominance"),
			new CoinGeckoSource("ethereum", "price"),
			new FearGreedSource(),
			new VIXSource(),
			new SPYSource(),
		];
		const gatherer = new Gatherer(sources);
		const signals = await gatherer.collectAll();

		for (const sig of signals) {
			if (sig) {
				// Ensure signal is not null
				await rabbitMQService.publish("signals", "", sig); // Service handles JSON.stringify and Buffer
			}
		}
	} catch (err) {
		console.error("[index] Error fetching/publishing signals:", err);
	}
}

async function main() {
	await setupBroker();

	// initial run
	await publishSignals();

	// schedule
	cron.schedule(CRON_SCHEDULE, async () => {
		console.log(`[index] Cron triggered (${CRON_SCHEDULE})`);
		await publishSignals();
	});

	console.log(`[index] Scheduler running with pattern: ${CRON_SCHEDULE}`);
}

// Graceful shutdown
process.on("SIGINT", async () => {
	console.log("\n[index] Caught SIGINT, shutting down...");
	await rabbitMQService.close();
	process.exit(0);
});

main().catch((err) => {
	console.error("[index] Fatal error:", err);
	process.exit(1);
});
