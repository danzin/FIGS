import {
  Errors,
  MACRO_EXCHANGES,
  MACRO_QUEUES,
  MACRO_ROUTING_KEYS,
  MacroRawArticle,
  RabbitMQService,
  SupportedMessage,
  toErrorResponse,
  wrapError,
} from "@financialsignalsgatheringsystem/common";
import { normalizeMacroArticle } from "./pipeline/entityNormalizer";
import { enrichWithEmbeddingMetadata } from "./pipeline/fingerprintClient";
import { RecentHashDedupe } from "./pipeline/dedupe";
import { extractMacroEvent } from "./pipeline/heuristicExtractor";
import { isMacroRelevant } from "./pipeline/keywordFilter";
import { EventPersister } from "./services/EventPersister";
import { Publisher } from "./services/Publisher";
import { config } from "./utils/config";

/** Safely coerces a wire-format date (string, number, or Date) to a Date object. */
function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

class MacroEventExtractorApp {
  private readonly messageBroker: RabbitMQService;
  private readonly persister: EventPersister;
  private readonly publisher: Publisher;
  private readonly dedupe = new RecentHashDedupe(10000);
  private isShuttingDown = false;

  constructor() {
    this.messageBroker = new RabbitMQService(config.RABBITMQ_URL);
    this.persister = new EventPersister({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
    });
    this.publisher = new Publisher(this.messageBroker);
    this.setupGracefulShutdown();
  }

  public async start(): Promise<void> {
    console.log("[MacroEventExtractor] Starting...");
    await this.messageBroker.connect();
    await this.persister.connect();

    await this.messageBroker.consume(
      MACRO_QUEUES.RAW_ARTICLE,
      MACRO_EXCHANGES.RAW,
      async (message: SupportedMessage): Promise<void> => {
        await this.handleIncomingMessage(message);
      },
      {
        bindingKeys: [MACRO_ROUTING_KEYS.RAW_ARTICLE],
        deadLettering: {
          maxRetries: 3,
          retryDelayMs: 30_000,
        },
        exchange: {
          type: "topic",
        },
      },
    );

    console.log(
      "[MacroEventExtractor] Ready and consuming macro raw articles.",
    );
  }

  private async handleIncomingMessage(
    message: SupportedMessage,
  ): Promise<void> {
    if (!this.isMacroRawArticle(message)) {
      throw Errors.validation(
        "Unsupported message received on macro raw article queue.",
        {
          context: {
            operation: "handleIncomingMessage",
            service: "macro-event-extractor-service",
          },
        },
      );
    }

    const normalizedIncoming = this.normalizeIncomingDates(message);
    if (this.dedupe.has(normalizedIncoming.content_hash)) {
      return;
    }
    this.dedupe.remember(normalizedIncoming.content_hash);

    const rawArticle = normalizeMacroArticle(normalizedIncoming);
    const rawArticleId = await this.persister.saveRawArticle(rawArticle);

    if (!isMacroRelevant(rawArticle)) {
      return;
    }

    const extractedEvent = await extractMacroEvent(rawArticle, {
      model: config.EXTRACTION_MODEL,
      version: config.EXTRACTION_VERSION,
    });

    const eventWithRawRef = { ...extractedEvent, raw_article_id: rawArticleId };
    const eventWithEmbeddingMetadata = await enrichWithEmbeddingMetadata(
      eventWithRawRef,
      config.EMBEDDING_MODEL,
    );

    await this.persister.saveMacroEvent(eventWithEmbeddingMetadata);
    await this.publisher.publishStructuredEvent(eventWithEmbeddingMetadata);
    await this.publisher.publishEmbeddingReady(eventWithEmbeddingMetadata);
  }

  private isMacroRawArticle(
    message: SupportedMessage,
  ): message is MacroRawArticle {
    // Use content_hash as discriminator, unique to MacroRawArticle in SupportedMessage.
    // Also validate required string fields since messages arrive over the wire as JSON.
    return (
      "content_hash" in message &&
      typeof message.id === "string" &&
      typeof message.source === "string" &&
      typeof message.content_hash === "string" &&
      message.fetched_at !== undefined
    );
  }

  private normalizeIncomingDates(article: MacroRawArticle): MacroRawArticle {
    // Messages arrive as JSON, date fields may be strings rather than Date objects.
    // toDate handles both cases safely without double assertions.
    const fetchedAt = toDate(article.fetched_at as unknown) ?? new Date();
    const publishedAt = toDate(article.published_at as unknown);

    return {
      ...article,
      fetched_at: fetchedAt,
      published_at: publishedAt,
    };
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log(`[MacroEventExtractor] Received ${signal}, shutting down...`);

      try {
        await this.messageBroker.close();
        await this.persister.close();
        process.exit(0);
      } catch (error) {
        const appError = wrapError(error, "InternalServerError", {
          context: {
            operation: "shutdown",
            signal,
            service: "macro-event-extractor-service",
          },
        });
        console.error(
          "[MacroEventExtractor] Shutdown error:",
          toErrorResponse(appError, { includeDebugInfo: true }),
        );
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("uncaughtException", (error) => {
      const appError = wrapError(error, "InternalServerError", {
        context: {
          operation: "uncaughtException",
          service: "macro-event-extractor-service",
        },
      });
      console.error(
        "[MacroEventExtractor] Uncaught exception:",
        toErrorResponse(appError, { includeDebugInfo: true }),
      );
      void shutdown("uncaughtException");
    });
    process.on("unhandledRejection", (reason) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      const appError = wrapError(error, "InternalServerError", {
        context: {
          operation: "unhandledRejection",
          service: "macro-event-extractor-service",
        },
      });
      console.error(
        "[MacroEventExtractor] Unhandled rejection:",
        toErrorResponse(appError, { includeDebugInfo: true }),
      );
      void shutdown("unhandledRejection");
    });
  }
}

const app = new MacroEventExtractorApp();
app.start().catch((error) => {
  const appError = wrapError(error, "InternalServerError", {
    context: {
      operation: "startup",
      service: "macro-event-extractor-service",
    },
  });
  console.error(
    "[MacroEventExtractor] Startup failure:",
    toErrorResponse(appError, { includeDebugInfo: true }),
  );
  process.exit(1);
});
