import amqp, { ChannelModel, Channel } from "amqplib";
import cron from "node-cron";

import { Gatherer } from "./gatherer";
import { FredSource } from "./datasources/fred";
// import { CoingeckoSource } from "./src/datasources/coingecko";
import { config } from "./utils/config";
import { datapoints } from "./utils/datapoints";
import { RabbitMQService } from "./services/RabbitMQService"; // Assuming you add this

// 1. Validate env
const FRED_API_KEY = config.FRED_API_KEY!;
const RABBITMQ_URL = config.RABBITMQ_URL!;
const CRON_SCHEDULE = config.CRON_SCHEDULE!;

if (!FRED_API_KEY) {
	// Extend for coingecko and rabbitmq url || !COINGECKO_API_URL || !RABBITMQ_URL
	console.error("[index] Missing one of FRED_API_KEY, COINGECKO_API_URL, or RABBITMQ_URL");
	process.exit(1);
}

const rabbitMQService = new RabbitMQService(RABBITMQ_URL); // Create instance
async function setupBroker() {
	await rabbitMQService.connect(); // Connects and creates channel internally
	// The service's connect method would handle asserting the exchange if you make it do so,
	// or you can do it after connecting if publish needs it explicitly and consume isn't used here.
	// For a publisher, often you don't need to assert the exchange if you're sure the consumer will.
	// However, it's good practice for the first publisher to ensure it exists.
	// So, you might add an `assertExchange` method to your RabbitMQService.
	// For now, let's assume the persister (consumer) asserts it.
	console.log("[index] RabbitMQService connected.");
}

async function publishSignals() {
	try {
		const sources = [new FredSource(FRED_API_KEY!, "M2SL")];
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
