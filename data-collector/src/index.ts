import dotenv from "dotenv";
import amqp, { ChannelModel, Channel } from "amqplib";
import cron from "node-cron";

import { Gatherer } from "./gatherer";
import { FredSource } from "./datasources/fred";
// import { CoingeckoSource } from "./src/datasources/coingecko";
import { config } from "./utils/config";
import { datapoints } from "./utils/datapoints";
dotenv.config();

// 1. Validate env
const FRED_API_KEY = config.FRED_API_KEY!;
const RABBITMQ_URL = config.RABBITMQ_URL!;
const CRON_SCHEDULE = config.CRON_SCHEDULE!;

if (!FRED_API_KEY) {
	// Extend for coingecko and rabbitmq url || !COINGECKO_API_URL || !RABBITMQ_URL
	console.error("[index] Missing one of FRED_API_KEY, COINGECKO_API_URL, or RABBITMQ_URL");
	process.exit(1);
}

/** Apparently in v0.10.7 of amqplib types,
 * amqp.connect() now resolves to a ChannelModel, not a Connection.
 * A ChannelModel is essentially a lightweight connection + channel factory */
let connModel: ChannelModel;
let channel: Channel;

async function setupBroker() {
	connModel = await amqp.connect(RABBITMQ_URL!);
	channel = await connModel.createChannel();
	// fanout so any number of processors can bind their queue
	await channel.assertExchange("signals", "fanout", { durable: true });
	console.log("[index] Connected to RabbitMQ, exchange `signals` ready");
}

async function publishSignals() {
	try {
		const sources = [
			new FredSource(FRED_API_KEY!, datapoints.get("FREDM2") as string),
			// new CoingeckoSource(COINGECKO_API_URL!),
			// more sources
		];

		const gatherer = new Gatherer(sources);
		const signals = await gatherer.collectAll();

		for (const sig of signals) {
			const payload = Buffer.from(JSON.stringify(sig));
			channel.publish("signals", "", payload, { persistent: true });
			console.log(`[index] Published ${sig.name}@${sig.timestamp.toISOString()}`);
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
	await channel.close();
	await connModel.close();
	process.exit(0);
});

main().catch((err) => {
	console.error("[index] Fatal error:", err);
	process.exit(1);
});
