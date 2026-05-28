import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { ScraperConfigManager } from "./scheduler/ScraperConfigManager";
import { logServiceError } from "./utils/errors";
import { config } from "./utils/config";

class ScraperApp {
  private messageBroker: RabbitMQService;
  private scraperManager: ScraperConfigManager;
  private isShuttingDown: boolean = false;

  constructor() {
    this.messageBroker = new RabbitMQService(config.RABBITMQ_URL!);
    this.scraperManager = new ScraperConfigManager(this.messageBroker);
    this.setupGracefulShutdown();
  }

  public async start(): Promise<void> {
    await this.messageBroker.connect();
    this.scraperManager.setupDefaultSchedules();
    this.scraperManager.getScheduler().start();
    console.log("[ScraperApp] Scraper service started and tasks scheduled.");
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        console.log(`[ScraperApp] Already shutting down, ignoring ${signal}`);
        return;
      }

      this.isShuttingDown = true;
      console.log(
        `[ScraperApp] Received ${signal}, starting graceful shutdown...`,
      );

      try {
        // Stop scheduler first
        this.scraperManager.getScheduler().stop();
        console.log("[ScraperApp] Scheduler stopped");

        // Close message broker connection
        await this.messageBroker.close();
        console.log("[ScraperApp] Message broker closed");

        console.log("[ScraperApp] Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logServiceError("[ScraperApp] Error during shutdown:", error, {
          operation: "shutdown",
          service: "scraper-service",
          signal,
        });
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("uncaughtException", (error) => {
      logServiceError("[ScraperApp] Uncaught exception:", error, {
        operation: "uncaughtException",
        service: "scraper-service",
      });
      void shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
      logServiceError("[ScraperApp] Unhandled rejection:", reason, {
        operation: "unhandledRejection",
        service: "scraper-service",
      });
      void shutdown("unhandledRejection");
    });
  }
}

const app = new ScraperApp();
app.start().catch((error) => {
  logServiceError("[ScraperApp] Failed to start:", error, {
    operation: "startup",
    service: "scraper-service",
  });
  process.exit(1);
});
