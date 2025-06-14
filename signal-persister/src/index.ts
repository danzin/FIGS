import { config } from "./utils/config";
import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { TimescaleDBService } from "./services/TimescaleDBService";
import { SignalProcessor } from "./SignalProcessor";

async function main() {
	console.log("[PersisterApp] Initializing...");

	// Validate essential configurations
	if (!config.RABBITMQ_URL || !config.DB_HOST) {
		console.error("[PersisterApp] Missing critical configuration. Exiting.");
		process.exit(1);
	}

	const rabbitMQService = new RabbitMQService(config.RABBITMQ_URL);
	const timescaleDBService = new TimescaleDBService({
		host: config.DB_HOST,
		port: Number(config.DB_PORT),
		user: config.DB_USER,
		password: config.DB_PASSWORD,
		database: config.DB_NAME,
	});

	const signalProcessor = new SignalProcessor(
		rabbitMQService,
		timescaleDBService,
		"signal_storage_queue", // Queue name
		"signals" // Exchange name
	);

	try {
		await signalProcessor.start();
		console.log("[PersisterApp] Signal Persister is running. To exit press CTRL+C");
	} catch (error) {
		console.error("[PersisterApp] Failed to start application:", error);
		await signalProcessor.stop().catch((err) => console.error("[PersisterApp] Error during shutdown:", err));
		process.exit(1);
	}

	// Graceful shutdown
	const gracefulShutdown = async (signal: string) => {
		console.log(`\n[PersisterApp] Caught ${signal}, shutting down gracefully...`);
		await signalProcessor.stop().catch((err) => console.error("[PersisterApp] Error during graceful shutdown:", err));
		console.log("[PersisterApp] Shutdown complete.");
		process.exit(0);
	};

	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

main().catch((error) => {
	console.error("[PersisterApp] Unhandled fatal error in main:", error);
	process.exit(1);
});
