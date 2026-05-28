import {
  Errors,
  RabbitMQService,
  MarketDataPoint,
  IndicatorDataPoint,
  SentimentResult,
  SupportedMessage,
  toErrorResponse,
  wrapError,
} from "@financialsignalsgatheringsystem/common";
import { TimescaleDBService } from "./services/TimescaleDBService";
import { config } from "./utils/config";

class SignalPersisterApp {
  private readonly messageBroker: RabbitMQService;
  private readonly dbService: TimescaleDBService;

  private isShuttingDown = false;

  constructor() {
    this.messageBroker = new RabbitMQService(config.RABBITMQ_URL);
    this.dbService = new TimescaleDBService({
      host: config.DB_HOST,
      port: Number(config.DB_PORT),
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
    });
    this.setupGracefulShutdown();
  }

  public async start(): Promise<void> {
    console.log("[Signal Persister App] Starting...");
    await this.messageBroker.connect();

    await this.setupMarketDataConsumer();
    await this.setupIndicatorConsumer();
    await this.setupSentimentResultConsumer();

    console.log("[Signal Persister App] All consumers started.");
  }

  private async setupMarketDataConsumer(): Promise<void> {
    await this.messageBroker.consume(
      "persist_market_data_queue",
      "market_data",
      async (message: SupportedMessage): Promise<void> => {
        if (!this.isMarketDataPoint(message)) {
          throw Errors.validation(
            "Received unsupported payload on market data persistence queue.",
            {
              context: {
                operation: "setupMarketDataConsumer",
                queueName: "persist_market_data_queue",
                service: "signal-persister",
              },
            },
          );
        }

        if (!this.isValidMarketDataPoint(message)) {
          throw Errors.validation(
            "Received invalid MarketDataPoint on market data persistence queue.",
            {
              context: {
                assetSymbol: message.asset_symbol,
                operation: "setupMarketDataConsumer",
                queueName: "persist_market_data_queue",
                service: "signal-persister",
              },
            },
          );
        }

        await this.dbService.insertMarketData(message);
      },
    );
  }

  private async setupIndicatorConsumer(): Promise<void> {
    await this.messageBroker.consume(
      "persist_indicators_queue",
      "market_indicators",
      async (message: SupportedMessage): Promise<void> => {
        if (!this.isIndicatorDataPoint(message)) {
          throw Errors.validation(
            "Received unsupported payload on indicator persistence queue.",
            {
              context: {
                operation: "setupIndicatorConsumer",
                queueName: "persist_indicators_queue",
                service: "signal-persister",
              },
            },
          );
        }

        if (!this.isValidIndicatorPoint(message)) {
          throw Errors.validation(
            "Received invalid IndicatorDataPoint on indicator persistence queue.",
            {
              context: {
                indicatorName: message.name,
                operation: "setupIndicatorConsumer",
                queueName: "persist_indicators_queue",
                service: "signal-persister",
              },
            },
          );
        }

        await this.dbService.insertIndicator(message);
      },
    );
  }

  private async setupSentimentResultConsumer(): Promise<void> {
    await this.messageBroker.consume<unknown>(
      "persist_sentiment_queue",
      "sentiment_results",
      async (message: unknown): Promise<void> => {
        if (!this.isValidSentimentResult(message)) {
          throw Errors.validation(
            "Received invalid SentimentResult on sentiment persistence queue.",
            {
              context: {
                operation: "setupSentimentResultConsumer",
                queueName: "persist_sentiment_queue",
                service: "signal-persister",
              },
            },
          );
        }

        const result: SentimentResult = message;

        console.log("[Signal Persister App] Received sentiment result:", {
          external_id: result.external_id,
          title: result.title?.substring(0, 50),
          published_at: result.published_at,
          published_at_type: typeof result.published_at,
        });

        await this.dbService.insertArticleAndSentiment(result);
        console.log(
          "[Signal Persister App] Successfully persisted article:",
          result.external_id,
        );
      },
    );
  }

  private isMarketDataPoint(payload: unknown): payload is MarketDataPoint {
    return (
      typeof payload === "object" &&
      payload !== null &&
      "asset_symbol" in payload &&
      typeof payload.asset_symbol === "string" &&
      "type" in payload &&
      typeof payload.type === "string"
    );
  }

  private isIndicatorDataPoint(
    payload: unknown,
  ): payload is IndicatorDataPoint {
    return (
      typeof payload === "object" &&
      payload !== null &&
      "name" in payload &&
      typeof payload.name === "string" &&
      !("asset_symbol" in payload)
    );
  }

  private isValidMarketDataPoint(p: MarketDataPoint): boolean {
    return (
      p.time instanceof Date &&
      !isNaN(p.time.getTime()) &&
      typeof p.value === "number"
    );
  }

  private isValidIndicatorPoint(p: IndicatorDataPoint): boolean {
    return (
      p.time instanceof Date &&
      !isNaN(p.time.getTime()) &&
      (typeof p.value === "number" || p.value === null)
    );
  }

  private isValidSentimentResult(payload: unknown): payload is SentimentResult {
    if (typeof payload !== "object" || payload === null) {
      return false;
    }

    if (
      !("external_id" in payload) ||
      typeof payload.external_id !== "string" ||
      !("title" in payload) ||
      typeof payload.title !== "string" ||
      !("url" in payload) ||
      typeof payload.url !== "string" ||
      !("published_at" in payload) ||
      typeof payload.published_at !== "string" ||
      Number.isNaN(new Date(payload.published_at).getTime()) ||
      !("sentiment_score" in payload) ||
      typeof payload.sentiment_score !== "number"
    ) {
      return false;
    }

    return true;
  }
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log(`[Signal Persister App] Received ${signal}, shutting down...`);
      try {
        await this.messageBroker.close();
        await this.dbService.disconnect();
        process.exit(0);
      } catch (error) {
        const appError = wrapError(error, "InternalServerError", {
          context: { operation: "shutdown", signal, service: "signal-persister" },
        });
        console.error(
          "[Signal Persister App] Shutdown error:",
          toErrorResponse(appError, { includeDebugInfo: true }),
        );
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("uncaughtException", (error) => {
      const appError = wrapError(error, "InternalServerError", {
        context: { operation: "uncaughtException", service: "signal-persister" },
      });
      console.error(
        "[Signal Persister App] Uncaught exception:",
        toErrorResponse(appError, { includeDebugInfo: true }),
      );
      void shutdown("uncaughtException");
    });
    process.on("unhandledRejection", (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const appError = wrapError(error, "InternalServerError", {
        context: { operation: "unhandledRejection", service: "signal-persister" },
      });
      console.error(
        "[Signal Persister App] Unhandled rejection:",
        toErrorResponse(appError, { includeDebugInfo: true }),
      );
      void shutdown("unhandledRejection");
    });
  }
}

// Start the application
const app = new SignalPersisterApp();
app.start().catch((error) => {
  const appError = wrapError(error, "InternalServerError", {
    context: {
      operation: "startup",
      service: "signal-persister",
    },
  });
  console.error(
    "[Signal Persister App] Failed to start:",
    toErrorResponse(appError, { includeDebugInfo: true }),
  );
  process.exit(1);
});
