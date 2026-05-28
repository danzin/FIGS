import cron from "node-cron";
import {
  Errors,
  isAppError,
  NewsArticle,
  MacroRawArticle,
  ScheduledDataSource,
  toErrorResponse,
} from "@financialsignalsgatheringsystem/common";
import { TaskResult } from "../datasources/datasources";
import {
  MessageBroker,
  MarketDataPoint,
  IndicatorDataPoint,
} from "@financialsignalsgatheringsystem/common";
import { MACRO_EXCHANGES, MACRO_ROUTING_KEYS } from "../models/macroQueueKeys";

export class TaskScheduler {
  private scheduledSources: Map<string, ScheduledDataSource> = new Map();
  private activeTasks: Map<string, cron.ScheduledTask> = new Map();
  private messageBroker: MessageBroker;
  private isRunning: boolean = false;

  constructor(messageBroker: MessageBroker) {
    this.messageBroker = messageBroker;
  }

  /**
   * Register a data source with scheduling configuration
   */
  public registerSource(config: ScheduledDataSource): void {
    const sourceKey = config.source.key;

    if (this.scheduledSources.has(sourceKey)) {
      console.warn(
        `[TaskScheduler] Source ${sourceKey} already registered. Updating configuration.`,
      );
      this.unregisterSource(sourceKey);
    }

    config.consecutiveFailures = 0;
    this.scheduledSources.set(sourceKey, config);

    console.log(
      `[TaskScheduler] Registered source: ${sourceKey} with schedule: ${config.schedule}`,
    );

    // If the scheduler is already running and the source is enabled, schedule it immediately
    if (this.isRunning && config.enabled) {
      this.scheduleSource(sourceKey, config);
      console.log(
        `[TaskScheduler] Immediately scheduled running task for ${sourceKey}`,
      );
    }
  }

  /**
   * Remove a data source from scheduling
   */
  public unregisterSource(sourceKey: string): void {
    const task = this.activeTasks.get(sourceKey);
    if (task) {
      task.stop();
      this.activeTasks.delete(sourceKey);
    }
    this.scheduledSources.delete(sourceKey);
    console.log(`[TaskScheduler] Unregistered source: ${sourceKey}`);
  }

  /**
   * Start all scheduled data collection tasks
   */
  public start(): void {
    if (this.isRunning) {
      console.warn("[TaskScheduler] Scheduler is already running");
      return;
    }
    for (const [key, cfg] of this.scheduledSources) {
      if (!cfg.enabled) continue;
      this.scheduleSource(key, cfg);

      // KICK IT OFF NOW
      this.triggerSource(key).catch((err) => {
        const errorDetails = isAppError(err)
          ? toErrorResponse(err, { includeDebugInfo: true })
          : err;
        console.error(
          `[TaskScheduler] Startup trigger failed for ${key}:`,
          errorDetails,
        );
      });
    }

    console.log("[TaskScheduler] Starting scheduler...");
    this.isRunning = true;
    console.log(this.scheduledSources);

    // Start health monitoring (runs every 5 minutes)
    this.startHealthMonitoring();

    console.log(
      `[TaskScheduler] Started ${this.activeTasks.size} scheduled tasks`,
    );
  }

  /**
   * Stop all scheduled tasks
   */
  public stop(): void {
    if (!this.isRunning) {
      console.warn("[TaskScheduler] Scheduler is not running");
      return;
    }

    console.log("[TaskScheduler] Stopping scheduler...");

    for (const [sourceKey, task] of this.activeTasks) {
      task.stop();
      console.log(`[TaskScheduler] Stopped task for ${sourceKey}`);
    }

    this.activeTasks.clear();
    this.isRunning = false;

    console.log("[TaskScheduler] Scheduler stopped");
  }

  /**
   * Manually trigger a specific data source
   */
  public async triggerSource(sourceKey: string): Promise<void> {
    const config = this.scheduledSources.get(sourceKey);
    if (!config) {
      throw Errors.notFound("Scheduled source", sourceKey, {
        context: {
          operation: "triggerSource",
          service: "task-scheduler",
        },
      });
    }

    console.log(`[TaskScheduler] Manually triggering ${sourceKey}`);
    await this.executeTask(sourceKey, config);
  }

  /**
   * Get status of all scheduled sources
   */
  public getStatus(): Array<{
    sourceKey: string;
    enabled: boolean;
    schedule: string;
    lastRun?: Date;
    lastSuccess?: Date;
    consecutiveFailures: number;
    isHealthy: boolean;
  }> {
    return Array.from(this.scheduledSources.entries()).map(
      ([sourceKey, config]) => ({
        sourceKey,
        enabled: config.enabled,
        schedule: config.schedule,
        lastRun: config.lastRun,
        lastSuccess: config.lastSuccess,
        consecutiveFailures: config.consecutiveFailures,
        isHealthy: this.isSourceHealthy(config),
      }),
    );
  }

  private scheduleSource(sourceKey: string, config: ScheduledDataSource): void {
    try {
      const task = cron.schedule(
        config.schedule,
        async () => {
          const jitterMs = Math.floor(Math.random() * 30000); // Random jitter between 0 and 30 seconds
          console.log(
            `[TaskScheduler] Task for ${sourceKey} triggered, applying ${jitterMs}ms jitter.`,
          );
          await this.sleep(jitterMs); // Apply jitter before collecting signal
          await this.executeTask(sourceKey, config);
        },
        {
          scheduled: false,
          timezone: "UTC",
        },
      );

      task.start();
      this.activeTasks.set(sourceKey, task);

      console.log(
        `[TaskScheduler] Scheduled ${sourceKey} with cron: ${config.schedule}`,
      );
    } catch (error) {
      console.error(`[TaskScheduler] Failed to schedule ${sourceKey}:`, error);
    }
  }

  private async executeTask(
    sourceKey: string,
    config: ScheduledDataSource,
  ): Promise<void> {
    const startTime = Date.now();
    config.lastRun = new Date();

    console.log(`[TaskScheduler] Executing task ${sourceKey}...`);

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= config.maxRetries) {
      try {
        const result = await config.source.fetch();
        if (result === null) {
          const duration = Date.now() - startTime;
          console.log(
            `[TaskScheduler] Task ${sourceKey} completed in ${duration}ms, returned null (no new data).`,
          );
          return; // Exit the function successfully.
        }
        const publishCount = await this.processAndPublishResult(
          result,
          sourceKey,
        );
        if (publishCount > 0) {
          // This was a true success with data.
          config.lastSuccess = new Date();
          config.consecutiveFailures = 0; // Reset failure counter
          const duration = Date.now() - startTime;
          console.log(
            `[TaskScheduler] Successfully published ${publishCount} data points from ${sourceKey} in ${duration}ms`,
          );
          return; // Exit the function successfully.
        } else {
          // The source returned data, but none of it was valid after processing.
          // This should be treated as a failure.
          throw new Error(
            "Source returned data, but no valid points could be published.",
          );
        }
      } catch (error) {
        attempt++;
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorDetails = isAppError(error)
          ? toErrorResponse(error, { includeDebugInfo: true })
          : lastError.message;

        console.error(
          `[TaskScheduler] Attempt ${attempt}/${config.maxRetries + 1} failed for ${sourceKey}:`,
          errorDetails,
        );

        if (attempt <= config.maxRetries) {
          // Wait before retrying with exponential backoff
          const delay = config.retryDelay * Math.pow(2, attempt - 1);
          console.log(`[TaskScheduler] Retrying ${sourceKey} in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    config.consecutiveFailures++;
    const duration = Date.now() - startTime;

    console.error(
      `[TaskScheduler] Failed to collect ${sourceKey} after ${config.maxRetries + 1} attempts in ${duration}ms. Last error:`,
      lastError?.message,
    );

    // Disable source if too many consecutive failures
    if (config.consecutiveFailures >= 10) {
      console.warn(
        `[TaskScheduler] Disabling ${sourceKey} due to ${config.consecutiveFailures} consecutive failures`,
      );
      config.enabled = false;
      this.unregisterSource(sourceKey);
    }
  }

  /**
   * Process and publish result based on its type
   * Returns the number of successfully published data points
   */
  private async processAndPublishResult(
    result: TaskResult,
    sourceKey: string,
  ): Promise<number> {
    if (!result) {
      console.warn(`[TaskScheduler] Null result from ${sourceKey}`);
      return 0;
    }

    const dataPoints = Array.isArray(result) ? result : [result];

    let publishCount = 0;

    for (const dp of dataPoints) {
      const pointType = this.getDataPointType(dp);
      switch (pointType) {
        case "MarketDataPoint":
          if (this.validateMarketDataPoint(dp)) {
            await this.messageBroker.publish("market_data", "", dp);
            publishCount++;
          } else {
            console.warn(
              `[TaskScheduler] Invalid MarketDataPoint from ${sourceKey}:`,
              dp,
            );
          }
          break;

        case "IndicatorDataPoint":
          if (this.validateIndicatorDataPoint(dp)) {
            await this.messageBroker.publish("market_indicators", "", dp);
            publishCount++;
          } else {
            console.warn(
              `[TaskScheduler] Invalid IndicatorDataPoint from ${sourceKey}:`,
              dp,
            );
          }
          break;
        case "MacroRawArticle":
          if (this.validateMacroRawArticle(dp)) {
            await this.messageBroker.publish(
              MACRO_EXCHANGES.RAW,
              MACRO_ROUTING_KEYS.RAW_ARTICLE,
              dp,
              {
                exchange: {
                  type: "topic",
                },
              },
            );
            publishCount++;
          } else {
            console.warn(
              `[TaskScheduler] Invalid MacroRawArticle from ${sourceKey}:`,
              dp,
            );
          }
          break;
        case "NewsArticle":
          if (this.validateNewsArticle(dp)) {
            await this.messageBroker.publish("raw_news", "", dp);
            publishCount++;
          } else {
            console.warn(
              `[TaskScheduler] Invalid NewsArticle from ${sourceKey}:`,
              dp,
            );
          }
          break;

        case "Unknown":
        default:
          console.error(
            `[TaskScheduler] Unknown datapoint type from ${sourceKey}:`,
            dp,
          );
          break;
      }
    }

    return publishCount;
  }

  private getDataPointType(
    point: unknown,
  ):
    | "MarketDataPoint"
    | "IndicatorDataPoint"
    | "NewsArticle"
    | "MacroRawArticle"
    | "Unknown" {
    if (typeof point !== "object" || point === null) return "Unknown";
    const p = point as Record<string, unknown>;
    const hasAssetSymbol =
      "asset_symbol" in p && typeof p.asset_symbol === "string";
    const hasName = "name" in p && typeof p.name === "string";
    const hasTime = "time" in p && p.time instanceof Date;
    const hasValue = "value" in p;
    const hasTitle = "title" in p && typeof p.title === "string";
    const hasUrl = "url" in p && typeof p.url === "string";
    const hasContentHash =
      "content_hash" in p && typeof p.content_hash === "string";
    const hasFetchedAt = "fetched_at" in p && p.fetched_at instanceof Date;

    if (hasAssetSymbol && hasTime && hasValue) {
      return "MarketDataPoint";
    }
    if (hasName && hasTime && hasValue) {
      return "IndicatorDataPoint";
    }
    if (hasContentHash && hasFetchedAt && typeof p.source === "string") {
      return "MacroRawArticle";
    }
    if (hasTitle && hasUrl) {
      return "NewsArticle";
    }
    return "Unknown";
  }

  // Validation functions
  private validateMarketDataPoint(point: unknown): point is MarketDataPoint {
    if (typeof point !== "object" || point === null) return false;
    const { time, asset_symbol, type, value, source } =
      point as Record<string, unknown>;
    // Value MUST be a number and not null.
    return (
      time instanceof Date &&
      !isNaN(time.getTime()) &&
      typeof asset_symbol === "string" &&
      typeof type === "string" &&
      typeof value === "number" &&
      !isNaN(value) &&
      typeof source === "string"
    );
  }

  private validateMacroRawArticle(article: unknown): article is MacroRawArticle {
    if (typeof article !== "object" || article === null) return false;
    const { id, source, fetched_at, content_hash } =
      article as Record<string, unknown>;
    return (
      typeof id === "string" &&
      typeof source === "string" &&
      fetched_at instanceof Date &&
      !isNaN(fetched_at.getTime()) &&
      typeof content_hash === "string"
    );
  }

  private validateNewsArticle(article: unknown): article is NewsArticle {
    if (typeof article !== "object" || article === null) return false;
    const { id, source, title, url, publishedAt } =
      article as Record<string, unknown>;
    return (
      typeof id === "string" &&
      typeof source === "string" &&
      typeof title === "string" &&
      typeof url === "string" &&
      // `publishedAt` will be a Date object from the scraper
      publishedAt instanceof Date &&
      !isNaN(publishedAt.getTime())
    );
  }

  private validateIndicatorDataPoint(
    point: unknown,
  ): point is IndicatorDataPoint {
    if (typeof point !== "object" || point === null) return false;
    const { time, name, value, source } = point as Record<string, unknown>;
    // Value CAN be a number OR null.
    return (
      time instanceof Date &&
      !isNaN(time.getTime()) &&
      typeof name === "string" &&
      (typeof value === "number" || value === null) &&
      typeof source === "string"
    );
  }

  private isSourceHealthy(config: ScheduledDataSource): boolean {
    const now = new Date();
    const hoursSinceLastSuccess = config.lastSuccess
      ? (now.getTime() - config.lastSuccess.getTime()) / (1000 * 60 * 60)
      : Infinity;

    return config.consecutiveFailures < 5 && hoursSinceLastSuccess < 24;
  }

  private startHealthMonitoring(): void {
    cron.schedule(
      "0 * * * *",
      () => {
        // Every 1 hour
        this.performHealthCheck();
      },
      {
        scheduled: true,
        timezone: "UTC",
      },
    );
  }

  private performHealthCheck(): void {
    const unhealthySources = Array.from(this.scheduledSources.entries())
      .filter(([_, config]) => config.enabled && !this.isSourceHealthy(config))
      .map(([sourceKey, _]) => sourceKey);

    if (unhealthySources.length > 0) {
      console.warn(
        `[TaskScheduler] Unhealthy sources detected: ${unhealthySources.join(", ")}`,
      );
    }

    // Log summary statistics
    const total = this.scheduledSources.size;
    const enabled = Array.from(this.scheduledSources.values()).filter(
      (c) => c.enabled,
    ).length;
    const healthy = Array.from(this.scheduledSources.values()).filter((c) =>
      this.isSourceHealthy(c),
    ).length;

    console.log(
      `[TaskScheduler] Health check: ${healthy}/${enabled} healthy sources (${total} total registered)`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
