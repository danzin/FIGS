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
import { enrichWithEmbeddingMetadata } from "./pipeline/embeddingClient";
import { RecentHashDedupe } from "./pipeline/dedupe";
import { extractMacroEvent } from "./pipeline/llmExtractor";
import { isMacroRelevant } from "./pipeline/keywordFilter";
import { EventPersister } from "./services/EventPersister";
import { Publisher } from "./services/Publisher";
import { config } from "./utils/config";

class MacroEventExtractorApp {
  private readonly messageBroker: RabbitMQService;
  private readonly persister: EventPersister;
  private readonly publisher: Publisher;
  private readonly dedupe = new RecentHashDedupe(10000);
  private isShuttingDown = false;

  constructor() {
    this.messageBroker = new RabbitMQService(config.RABBITMQ_URL!);
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
    const candidate = message as Partial<MacroRawArticle>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.source === "string" &&
      typeof candidate.content_hash === "string" &&
      candidate.fetched_at !== undefined
    );
  }

  private normalizeIncomingDates(article: MacroRawArticle): MacroRawArticle {
    const fetchedAt = new Date(article.fetched_at as unknown as string | Date);
    const publishedAt = article.published_at
      ? new Date(article.published_at as unknown as string | Date)
      : undefined;

    return {
      ...article,
      fetched_at: !isNaN(fetchedAt.getTime()) ? fetchedAt : new Date(),
      published_at:
        publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
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
