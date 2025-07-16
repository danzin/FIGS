import { config } from "./utils/config";
import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { TimescaleDBService } from "./services/TimescaleDBService";
import { SignalProcessor } from "./SignalProcessor";

async function main() {
	console.log("[SignalPersisterApp] Initializing...");

	// Validate essential configurations
	if (!config.RABBITMQ_URL || !config.DB_HOST) {
		console.error("[SignalPersisterApp] Missing critical RabbitMQ and Database configuration. Exiting.");
		process.exit(1);
	}

	// Initialize services
	const rabbit = new RabbitMQService(config.RABBITMQ_URL);
	const timescaleDBService = new TimescaleDBService({
		host: config.DB_HOST,
		port: Number(config.DB_PORT),
		user: config.DB_USER,
		password: config.DB_PASSWORD,
		database: config.DB_NAME,
	});

	await rabbit.connect();
	await timescaleDBService.connect();

	console.log("[SignalPersisterApp] Services connected, spinning up consumers…");

	// Create the SignalProcessor instances with the services and queue/exchange names
	const priceProc = new SignalProcessor(rabbit, timescaleDBService, "market_data_queue", "market_data");
	const indicatorProc = new SignalProcessor(rabbit, timescaleDBService, "market_indicators_queue", "market_indicators");

	try {
		await Promise.all([priceProc.start(), indicatorProc.start()]);
		console.log("[SignalPersisterApp] All processors running – wait for data!");
	} catch (error) {
		console.error("[SignalPersisterApp] Failed to start application:", error);
		await Promise.all([
			priceProc.stop().catch((err) => console.error("[SignalPersisterApp] Error during shutdown:", err)),
			indicatorProc.stop().catch((err) => console.error("[SignalPersisterApp] Error during shutdown:", err)),
		]);
		await timescaleDBService.disconnect();
		process.exit(1);
	}

	// Graceful shutdown
	const gracefulShutdown = async (signal: string) => {
		console.log(`\n[SignalPersisterApp] Caught ${signal}, shutting down gracefully...`);
		await Promise.all([
			priceProc.stop().catch((err) => console.error("[SignalPersisterApp] Error during graceful shutdown:", err)),
			indicatorProc.stop().catch((err) => console.error("[SignalPersisterApp] Error during graceful shutdown:", err)),
		]);
		await timescaleDBService.disconnect();
		process.exit(0);
	};

	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

main().catch((error) => {
	console.error("[SignalPersisterApp] Unhandled fatal error in main:", error);
	process.exit(1);
});
