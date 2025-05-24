import { RabbitMQService } from "./services/RabbitMQService";
import { SchedulerConfigManager } from "./SchedulerConfigManager";
import { config } from "./utils/config";
import express, { Request, Response } from "express";

class DataCollectorApp {
	private messageBroker: RabbitMQService;
	private schedulerManager: SchedulerConfigManager;
	private app: express.Application;
	private isShuttingDown: boolean = false;

	constructor() {
		this.messageBroker = new RabbitMQService(config.RABBITMQ_URL!);
		this.schedulerManager = new SchedulerConfigManager(this.messageBroker);
		this.app = express();

		this.setupExpress();
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

			// Start HTTP API for monitoring and control
			const port = config.PORT!;
			this.app.listen(port, () => {
				console.log(`[DataCollectorApp] HTTP API listening on port ${port}`);
			});

			console.log("[DataCollectorApp] Application started successfully");

			// Log initial status
			setTimeout(() => {
				this.logSchedulerStatus();
			}, 10000);
		} catch (error) {
			console.error("[DataCollectorApp] Failed to start application:", error);
			process.exit(1);
		}
	}

	private setupExpress(): void {
		this.app.use(express.json());

		// Health check endpoint
		this.app.get("/health", (req: Request, res: Response) => {
			res.json({
				status: "healthy",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
			});
		});

		// Get scheduler status
		this.app.get("/status", (req: Request, res: Response) => {
			const status = this.schedulerManager.getScheduler().getStatus();
			res.json({
				sources: status,
				summary: {
					total: status.length,
					enabled: status.filter((s) => s.enabled).length,
					healthy: status.filter((s) => s.isHealthy).length,
					failing: status.filter((s) => s.consecutiveFailures > 0).length,
				},
			});
		});

		// Manually trigger a specific source
		this.app.post("/trigger/:sourceKey", async (req: Request, res: Response) => {
			const { sourceKey } = req.params;

			try {
				await this.schedulerManager.getScheduler().triggerSource(sourceKey);
				res.json({
					success: true,
					message: `Triggered ${sourceKey}`,
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				res.status(400).json({
					success: false,
					error: errorMessage,
				});
			}
		});
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
