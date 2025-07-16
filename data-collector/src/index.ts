import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { HealthService } from "./services/HealthService";
import { SchedulerConfigManager } from "./SchedulerConfigManager";
import { ApiServer } from "./api/ApiServer";
import { config } from "./utils/config";
import { SystemMonitor } from "./SystemMonitor";

class DataCollectorApp {
	private messageBroker: RabbitMQService;
	private schedulerManager: SchedulerConfigManager;
	private apiServer: ApiServer;
	private isShuttingDown: boolean = false;
	private healthService: HealthService;
	private systemMonitor: SystemMonitor;

	constructor() {
		this.messageBroker = new RabbitMQService(config.RABBITMQ_URL!);
		this.schedulerManager = new SchedulerConfigManager(this.messageBroker);
		this.healthService = new HealthService(this.schedulerManager, this.messageBroker);
		this.apiServer = new ApiServer(this.schedulerManager, this.healthService);
		this.systemMonitor = new SystemMonitor(this.healthService);
		this.setupGracefulShutdown();
	}

	public async start(): Promise<void> {
		try {
			console.log("[DataCollectorApp] Starting application...");

			// Connect to message broker
			await this.messageBroker.connect();
			console.log("[DataCollectorApp] Connected to RabbitMQ");

			// Setup all data source schedules
			this.schedulerManager.setupDefaultSchedules();

			// Scheduler supports market hours aware scheduling, but it's not necessary as of now
			// this.schedulerManager.setupMarketHoursAwareSchedules();

			// Start the scheduler
			this.schedulerManager.getScheduler().start();
			console.log("[DataCollectorApp] Scheduler started");

			// Start HTTP API server
			const port = config.PORT!;
			this.apiServer.listen(Number(port));

			console.log("[DataCollectorApp] Application started successfully");

			console.log(`[DataCollectorApp] Starting system monitor`);
			this.systemMonitor.startMonitoring();
			// Log initial status after a delay
			setTimeout(() => {
				this.logSchedulerStatus();
			}, 10000);
		} catch (error) {
			console.error("[DataCollectorApp] Failed to start application:", error);
			process.exit(1);
		}
	}

	private setupGracefulShutdown(): void {
		const shutdown = async (signal: string) => {
			if (this.isShuttingDown) {
				console.log(`[DataCollectorApp] Already shutting down, ignoring ${signal}`);
				return;
			}

			this.isShuttingDown = true;
			console.log(`[DataCollectorApp] Received ${signal}, starting graceful shutdown...`);

			try {
				// Stop scheduler first
				this.schedulerManager.getScheduler().stop();
				console.log("[DataCollectorApp] Scheduler stopped");

				// Close message broker connection
				await this.messageBroker.close();
				console.log("[DataCollectorApp] Message broker closed");

				this.systemMonitor.stopMonitoring();
				console.log("[DataCollectorApp] System monitor stopped");

				console.log("[DataCollectorApp] Graceful shutdown completed");
				process.exit(0);
			} catch (error) {
				console.error("[DataCollectorApp] Error during shutdown:", error);
				process.exit(1);
			}
		};

		process.on("SIGTERM", () => shutdown("SIGTERM"));
		process.on("SIGINT", () => shutdown("SIGINT"));

		process.on("uncaughtException", (error) => {
			console.error("[DataCollectorApp] Uncaught exception:", error);
			shutdown("uncaughtException");
		});

		process.on("unhandledRejection", (reason, promise) => {
			console.error("[DataCollectorApp] Unhandled rejection at:", promise, "reason:", reason);
			shutdown("unhandledRejection");
		});
	}

	private logSchedulerStatus(): void {
		const status = this.schedulerManager.getScheduler().getStatus();

		console.log("\n[DataCollectorApp] ===== SCHEDULER STATUS =====");
		status.forEach((source) => {
			const healthIcon = source.isHealthy ? "✅" : "❌";
			const enabledIcon = source.enabled ? "🟢" : "⭕";

			console.log(`${healthIcon} ${enabledIcon} ${source.sourceKey}`);
			console.log(`   Schedule: ${source.schedule}`);
			if (source.lastSuccess) {
				console.log(`   Last Success: ${source.lastSuccess.toISOString()}`);
			}
			if (source.consecutiveFailures > 0) {
				console.log(`   Failures: ${source.consecutiveFailures}`);
			}
			console.log("");
		});
		console.log("[DataCollectorApp] ================================\n");
	}
}

// Start the application
const app = new DataCollectorApp();
app.start().catch((error) => {
	console.error("[DataCollectorApp] Failed to start:", error);
	process.exit(1);
});

export { DataCollectorApp };
