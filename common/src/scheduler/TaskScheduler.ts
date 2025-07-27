import cron from "node-cron";
import { NewsArticle, ScheduledDataSource, TaskResult } from "@financialsignalsgatheringsystem/common";
import { MessageBroker, MarketDataPoint, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

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
			console.warn(`[TaskScheduler] Source ${sourceKey} already registered. Updating configuration.`);
			this.unregisterSource(sourceKey);
		}

		config.consecutiveFailures = 0;
		this.scheduledSources.set(sourceKey, config);

		console.log(`[TaskScheduler] Registered source: ${sourceKey} with schedule: ${config.schedule}`);

		// If the scheduler is already running and the source is enabled, schedule it immediately
		if (this.isRunning && config.enabled) {
			this.scheduleSource(sourceKey, config);
			console.log(`[TaskScheduler] Immediately scheduled running task for ${sourceKey}`);
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
			this.triggerSource(key).catch((err) => console.error(`[TaskScheduler] Startup trigger failed for ${key}:`, err));
		}

		console.log("[TaskScheduler] Starting scheduler...");
		this.isRunning = true;
		console.log(this.scheduledSources);
		for (const [sourceKey, config] of this.scheduledSources) {
			if (config.enabled) {
				this.scheduleSource(sourceKey, config);
			}
		}

		// Start health monitoring (runs every 5 minutes)
		this.startHealthMonitoring();

		console.log(`[TaskScheduler] Started ${this.activeTasks.size} scheduled tasks`);
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
			throw new Error(`Source ${sourceKey} not found`);
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
		return Array.from(this.scheduledSources.entries()).map(([sourceKey, config]) => ({
			sourceKey,
			enabled: config.enabled,
			schedule: config.schedule,
			lastRun: config.lastRun,
			lastSuccess: config.lastSuccess,
			consecutiveFailures: config.consecutiveFailures,
			isHealthy: this.isSourceHealthy(config),
		}));
	}

	private scheduleSource(sourceKey: string, config: ScheduledDataSource): void {
		try {
			const task = cron.schedule(
				config.schedule,
				async () => {
					const jitterMs = Math.floor(Math.random() * 30000); // Random jitter between 0 and 30 seconds
					console.log(`[TaskScheduler] Task for ${sourceKey} triggered, applying ${jitterMs}ms jitter.`);
					await this.sleep(jitterMs); // Apply jitter before collecting signal
					await this.executeTask(sourceKey, config);
				},
				{
					scheduled: false,
					timezone: "UTC",
				}
			);

			task.start();
			this.activeTasks.set(sourceKey, task);

			console.log(`[TaskScheduler] Scheduled ${sourceKey} with cron: ${config.schedule}`);
		} catch (error) {
			console.error(`[TaskScheduler] Failed to schedule ${sourceKey}:`, error);
		}
	}

	private async executeTask(sourceKey: string, config: ScheduledDataSource): Promise<void> {
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
					console.log(`[TaskScheduler] Task ${sourceKey} completed in ${duration}ms, returned null (no new data).`);
					return; // Exit the function successfully.
				}
				const publishCount = await this.processAndPublishResult(result, sourceKey);
				if (publishCount > 0) {
					// This was a true success with data.
					config.lastSuccess = new Date();
					config.consecutiveFailures = 0; // Reset failure counter
					const duration = Date.now() - startTime;
					console.log(
						`[TaskScheduler] Successfully published ${publishCount} data points from ${sourceKey} in ${duration}ms`
					);
					return; // Exit the function successfully.
				} else {
					// The source returned data, but none of it was valid after processing.
					// This should be treated as a failure.
					throw new Error("Source returned data, but no valid points could be published.");
				}
			} catch (error) {
				attempt++;
				lastError = error instanceof Error ? error : new Error(String(error));

				console.error(
					`[TaskScheduler] Attempt ${attempt}/${config.maxRetries + 1} failed for ${sourceKey}:`,
					lastError.message
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
			lastError?.message
		);

		// Disable source if too many consecutive failures
		if (config.consecutiveFailures >= 10) {
			console.warn(`[TaskScheduler] Disabling ${sourceKey} due to ${config.consecutiveFailures} consecutive failures`);
			config.enabled = false;
			this.unregisterSource(sourceKey);
		}
	}

	/**
	 * Process and publish result based on its type
	 * Returns the number of successfully published data points
	 */
	private async processAndPublishResult(result: TaskResult, sourceKey: string): Promise<number> {
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
						console.warn(`[TaskScheduler] Invalid MarketDataPoint from ${sourceKey}:`, dp);
					}
					break;

				case "IndicatorDataPoint":
					if (this.validateIndicatorDataPoint(dp)) {
						await this.messageBroker.publish("market_indicators", "", dp);
						publishCount++;
					} else {
						console.warn(`[TaskScheduler] Invalid IndicatorDataPoint from ${sourceKey}:`, dp);
					}
					break;
				case "NewsArticle":
					if (this.validateNewsArticle(dp)) {
						await this.messageBroker.publish("raw_news", "", dp);
						publishCount++;
					} else {
						console.warn(`[TaskScheduler] Invalid NewsArticle from ${sourceKey}:`, dp);
					}
					break;

				case "Unknown":
				default:
					console.error(`[TaskScheduler] Unknown datapoint type from ${sourceKey}:`, dp);
					break;
			}
		}

		return publishCount;
	}

	private getDataPointType(point: any): "MarketDataPoint" | "IndicatorDataPoint" | "NewsArticle" | "Unknown" {
		const hasAssetSymbol = "asset_symbol" in point && typeof point.asset_symbol === "string";
		const hasName = "name" in point && typeof point.name === "string";
		const hasTime = "time" in point && point.time instanceof Date;
		const hasValue = "value" in point; // We don't care about the type of value here
		const hasTitle = "title" in point && typeof point.title === "string";
		const hasUrl = "url" in point && typeof point.url === "string";

		if (hasAssetSymbol && hasTime && hasValue) {
			return "MarketDataPoint";
		}
		if (hasName && hasTime && hasValue) {
			return "IndicatorDataPoint";
		}
		if (hasTitle && hasUrl) {
			return "NewsArticle";
		}
		return "Unknown";
	}

	// Validation functions
	private validateMarketDataPoint(point: any): point is MarketDataPoint {
		// Value MUST be a number and not null.
		return (
			point &&
			point.time instanceof Date &&
			!isNaN(point.time.getTime()) &&
			typeof point.asset_symbol === "string" &&
			typeof point.type === "string" &&
			typeof point.value === "number" &&
			!isNaN(point.value) &&
			typeof point.source === "string"
		);
	}

	private validateNewsArticle(article: any): article is NewsArticle {
		return (
			article &&
			typeof article.id === "string" &&
			typeof article.source === "string" &&
			typeof article.title === "string" &&
			typeof article.url === "string" &&
			// `publishedAt` will be a Date object from the scraper
			article.publishedAt instanceof Date &&
			!isNaN(article.publishedAt.getTime())
		);
	}

	private validateIndicatorDataPoint(point: any): point is IndicatorDataPoint {
		// Value CAN be a number OR null.
		return (
			point &&
			point.time instanceof Date &&
			!isNaN(point.time.getTime()) &&
			typeof point.name === "string" &&
			(typeof point.value === "number" || point.value === null) &&
			typeof point.source === "string"
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
			}
		);
	}

	private performHealthCheck(): void {
		const unhealthySources = Array.from(this.scheduledSources.entries())
			.filter(([_, config]) => config.enabled && !this.isSourceHealthy(config))
			.map(([sourceKey, _]) => sourceKey);

		if (unhealthySources.length > 0) {
			console.warn(`[TaskScheduler] Unhealthy sources detected: ${unhealthySources.join(", ")}`);
		}

		// Log summary statistics
		const total = this.scheduledSources.size;
		const enabled = Array.from(this.scheduledSources.values()).filter((c) => c.enabled).length;
		const healthy = Array.from(this.scheduledSources.values()).filter((c) => this.isSourceHealthy(c)).length;

		console.log(`[TaskScheduler] Health check: ${healthy}/${enabled} healthy sources (${total} total registered)`);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
