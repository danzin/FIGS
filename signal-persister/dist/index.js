"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./utils/config");
const common_1 = require("@financialsignalsgatheringsystem/common");
const TimescaleDBService_1 = require("./services/TimescaleDBService");
const SignalProcessor_1 = require("./SignalProcessor");
async function main() {
    console.log("[SignalPersisterApp] Initializing...");
    // Validate essential configurations
    if (!config_1.config.RABBITMQ_URL || !config_1.config.DB_HOST) {
        console.error("[SignalPersisterApp] Missing critical RabbitMQ and Database configuration. Exiting.");
        process.exit(1);
    }
    // Initialize services
    const rabbitMQService = new common_1.RabbitMQService(config_1.config.RABBITMQ_URL);
    const timescaleDBService = new TimescaleDBService_1.TimescaleDBService({
        host: config_1.config.DB_HOST,
        port: Number(config_1.config.DB_PORT),
        user: config_1.config.DB_USER,
        password: config_1.config.DB_PASSWORD,
        database: config_1.config.DB_NAME,
    });
    // Create the SignalProcessor instance with the services and queue/exchange names
    const signalProcessor = new SignalProcessor_1.SignalProcessor(rabbitMQService, timescaleDBService, "signal_storage_queue", // Queue name
    "signals" // Exchange name
    );
    try {
        await signalProcessor.start();
        console.log("[SignalPersisterApp] Signal Persister is running. To exit press CTRL+C");
    }
    catch (error) {
        console.error("[SignalPersisterApp] Failed to start application:", error);
        await signalProcessor.stop().catch((err) => console.error("[SignalPersisterApp] Error during shutdown:", err));
        process.exit(1);
    }
    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
        console.log(`\n[SignalPersisterApp] Caught ${signal}, shutting down gracefully...`);
        await signalProcessor
            .stop()
            .catch((err) => console.error("[SignalPersisterApp] Error during graceful shutdown:", err));
        console.log("[SignalPersisterApp] Shutdown complete.");
        process.exit(0);
    };
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}
main().catch((error) => {
    console.error("[SignalPersisterApp] Unhandled fatal error in main:", error);
    process.exit(1);
});
