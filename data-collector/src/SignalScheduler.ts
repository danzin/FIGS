import cron from "node-cron";
import { DataSource } from "./datasources/Datasource";
import { MessageBroker, Signal, MarketDataPoint, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

export interface ScheduledDataSource {
	source: DataSource;
	schedule: string; // cron expression
	enabled: boolean;
	priority: "high" | "medium" | "low";
	maxRetries: number;
	retryDelay: number; // milliseconds
	lastRun?: Date;
	lastSuccess?: Date;
	consecutiveFailures: number;
}

// Union type for all possible data source return types
type DataSourceResult = Signal | MarketDataPoint[] | IndicatorDataPoint | null;

export class SignalScheduler {
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
			console.warn(`[SignalScheduler] Source ${sourceKey} already registered. Updating configuration.`);
			this.unregisterSource(sourceKey);
		}

		config.consecutiveFailures = 0;
		this.scheduledSources.set(sourceKey, config);

		console.log(`[SignalScheduler] Registered source: ${sourceKey} with schedule: ${config.schedule}`);

		// If the scheduler is already running and the source is enabled, schedule it immediately
		if (this.isRunning && config.enabled) {
			this.scheduleSource(sourceKey, config);
			console.log(`[SignalScheduler] Immediately scheduled running task for ${sourceKey}`);
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
		console.log(`[SignalScheduler] Unregistered source: ${sourceKey}`);
	}

	/**
	 * Start all scheduled data collection tasks
	 */
	public start(): void {
		if (this.isRunning) {
			console.warn("[SignalScheduler] Scheduler is already running");
			return;
		}

		console.log("[SignalScheduler] Starting scheduler...");
		this.isRunning = true;
		console.log(this.scheduledSources);
		for (const [sourceKey, config] of this.scheduledSources) {
			if (config.enabled) {
				this.scheduleSource(sourceKey, config);
			}
		}

		// Start health monitoring (runs every 5 minutes)
		this.startHealthMonitoring();

		console.log(`[SignalScheduler] Started ${this.activeTasks.size} scheduled tasks`);
	}

	/**
	 * Stop all scheduled tasks
	 */
	public stop(): void {
		if (!this.isRunning) {
			console.warn("[SignalScheduler] Scheduler is not running");
			return;
		}

		console.log("[SignalScheduler] Stopping scheduler...");

		for (const [sourceKey, task] of this.activeTasks) {
			task.stop();
			console.log(`[SignalScheduler] Stopped task for ${sourceKey}`);
		}

		this.activeTasks.clear();
		this.isRunning = false;

		console.log("[SignalScheduler] Scheduler stopped");
	}

	/**
	 * Manually trigger a specific data source
	 */
	public async triggerSource(sourceKey: string): Promise<void> {
		const config = this.scheduledSources.get(sourceKey);
		if (!config) {
			throw new Error(`Source ${sourceKey} not found`);
		}

		console.log(`[SignalScheduler] Manually triggering ${sourceKey}`);
		await this.collectSignal(sourceKey, config);
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
					console.log(`[SignalScheduler] Task for ${sourceKey} triggered, applying ${jitterMs}ms jitter.`);
					await this.sleep(jitterMs); // Apply jitter before collecting signal
					await this.collectSignal(sourceKey, config);
				},
				{
					scheduled: false,
					timezone: "UTC",
				}
			);

			task.start();
			this.activeTasks.set(sourceKey, task);

			console.log(`[SignalScheduler] Scheduled ${sourceKey} with cron: ${config.schedule}`);
		} catch (error) {
			console.error(`[SignalScheduler] Failed to schedule ${sourceKey}:`, error);
		}
	}

	private async collectSignal(sourceKey: string, config: ScheduledDataSource): Promise<void> {
		const startTime = Date.now();
		config.lastRun = new Date();

		console.log(`[SignalScheduler] Collecting signal from ${sourceKey}...`);

		let attempt = 0;
		let lastError: Error | null = null;

		while (attempt <= config.maxRetries) {
			try {
				const result = await config.source.fetch();

				if (result) {
					// Validate and publish the result based on its type
					const publishCount = await this.processAndPublishResult(result, sourceKey);

					if (publishCount > 0) {
						config.lastSuccess = new Date();
						config.consecutiveFailures = 0;

						const duration = Date.now() - startTime;
						console.log(
							`[SignalScheduler] Successfully collected and published ${publishCount} data points from ${sourceKey} in ${duration}ms`
						);
						return;
					} else {
						throw new Error("No valid data points could be published");
					}
				} else {
					console.warn(`[SignalScheduler] ${sourceKey} returned null result`);
					config.consecutiveFailures++;
					return;
				}
			} catch (error) {
				attempt++;
				lastError = error instanceof Error ? error : new Error(String(error));

				console.error(
					`[SignalScheduler] Attempt ${attempt}/${config.maxRetries + 1} failed for ${sourceKey}:`,
					lastError.message
				);

				if (attempt <= config.maxRetries) {
					// Wait before retrying with exponential backoff
					const delay = config.retryDelay * Math.pow(2, attempt - 1);
					console.log(`[SignalScheduler] Retrying ${sourceKey} in ${delay}ms...`);
					await this.sleep(delay);
				}
			}
		}

		// All retries failed
		config.consecutiveFailures++;
		const duration = Date.now() - startTime;

		console.error(
			`[SignalScheduler] Failed to collect ${sourceKey} after ${config.maxRetries + 1} attempts in ${duration}ms. Last error:`,
			lastError?.message
		);

		// Disable source if too many consecutive failures
		if (config.consecutiveFailures >= 10) {
			console.warn(
				`[SignalScheduler] Disabling ${sourceKey} due to ${config.consecutiveFailures} consecutive failures`
			);
			config.enabled = false;
			this.unregisterSource(sourceKey);
		}
	}

	/**
	 * Process and publish result based on its type
	 * Returns the number of successfully published data points
	 */
	private async processAndPublishResult(result: DataSourceResult, sourceKey: string): Promise<number> {
		if (!result) {
			console.warn(`[SignalScheduler] Null result from ${sourceKey}`);
			return 0;
		}

		let publishCount = 0;

		// Handle MarketDataPoint array
		if (Array.isArray(result)) {
			console.log(`[SignalScheduler] Processing ${result.length} MarketDataPoint(s) from ${sourceKey}`);

			for (const dataPoint of result) {
				if (this.validateMarketDataPoint(dataPoint)) {
					try {
						await this.messageBroker.publish("market_data", "", dataPoint);
						publishCount++;
						console.log(
							`[SignalScheduler] Published MarketDataPoint: ${dataPoint.asset_symbol} ${dataPoint.type} = ${dataPoint.value}`
						);
					} catch (error) {
						console.error(`[SignalScheduler] Failed to publish MarketDataPoint:`, error);
					}
				} else {
					console.warn(`[SignalScheduler] Invalid MarketDataPoint from ${sourceKey}:`, dataPoint);
				}
			}
		}
		// Handle single IndicatorDataPoint
		else if (this.isIndicatorDataPoint(result)) {
			console.log(`[SignalScheduler] Processing IndicatorDataPoint from ${sourceKey}`);

			if (this.validateIndicatorDataPoint(result)) {
				try {
					await this.messageBroker.publish("indicators", "", result);
					publishCount++;
					console.log(`[SignalScheduler] Published IndicatorDataPoint: ${result.name} = ${result.value}`);
				} catch (error) {
					console.error(`[SignalScheduler] Failed to publish IndicatorDataPoint:`, error);
				}
			} else {
				console.warn(`[SignalScheduler] Invalid IndicatorDataPoint from ${sourceKey}:`, result);
			}
		}
		// Handle legacy Signal
		else if (this.isSignal(result)) {
			console.log(`[SignalScheduler] Processing legacy Signal from ${sourceKey}`);

			if (this.validateSignal(result)) {
				try {
					await this.messageBroker.publish("signals", "", result);
					publishCount++;
					console.log(`[SignalScheduler] Published Signal: ${result.name} = ${result.value}`);
				} catch (error) {
					console.error(`[SignalScheduler] Failed to publish Signal:`, error);
				}
			} else {
				console.warn(`[SignalScheduler] Invalid Signal from ${sourceKey}:`, result);
			}
		} else {
			console.error(`[SignalScheduler] Unknown result type from ${sourceKey}:`, typeof result, result);
		}

		return publishCount;
	}

	// Type guards
	private isSignal(obj: any): obj is Signal {
		return (
			obj &&
			typeof obj.name === "string" &&
			obj.timestamp instanceof Date &&
			typeof obj.value === "number" &&
			typeof obj.source === "string"
		);
	}

	private isIndicatorDataPoint(obj: any): obj is IndicatorDataPoint {
		return (
			obj &&
			typeof obj.name === "string" &&
			obj.time instanceof Date &&
			typeof obj.value === "number" &&
			typeof obj.source === "string"
		);
	}

	// Validation functions
	private validateMarketDataPoint(dataPoint: MarketDataPoint): boolean {
		const isValid = !!(
			dataPoint &&
			dataPoint.time instanceof Date &&
			!isNaN(dataPoint.time.getTime()) &&
			typeof dataPoint.asset_symbol === "string" &&
			dataPoint.asset_symbol.length > 0 &&
			typeof dataPoint.type === "string" &&
			dataPoint.type.length > 0 &&
			typeof dataPoint.value === "number" &&
			!isNaN(dataPoint.value) &&
			typeof dataPoint.source === "string" &&
			dataPoint.source.length > 0
		);

		if (!isValid) {
			console.warn(`[SignalScheduler] MarketDataPoint validation failed:`, {
				hasTime: dataPoint?.time instanceof Date,
				timeValid: dataPoint?.time ? !isNaN(dataPoint.time.getTime()) : false,
				hasAssetSymbol: typeof dataPoint?.asset_symbol === "string",
				assetSymbolValid: typeof dataPoint?.asset_symbol === "string" && dataPoint.asset_symbol.length > 0,
				hasType: typeof dataPoint?.type === "string",
				typeValid: typeof dataPoint?.type === "string" && dataPoint.type.length > 0,
				hasValue: typeof dataPoint?.value === "number",
				valueValid: typeof dataPoint?.value === "number" && !isNaN(dataPoint.value),
				hasSource: typeof dataPoint?.source === "string",
				sourceValid: typeof dataPoint?.source === "string" && dataPoint.source.length > 0,
			});
		}

		return isValid;
	}

	private validateIndicatorDataPoint(dataPoint: IndicatorDataPoint): boolean {
		const isValid = !!(
			dataPoint &&
			typeof dataPoint.name === "string" &&
			dataPoint.name.length > 0 &&
			dataPoint.time instanceof Date &&
			!isNaN(dataPoint.time.getTime()) &&
			typeof dataPoint.value === "number" &&
			!isNaN(dataPoint.value) &&
			typeof dataPoint.source === "string" &&
			dataPoint.source.length > 0
		);

		if (!isValid) {
			console.warn(`[SignalScheduler] IndicatorDataPoint validation failed:`, {
				hasName: typeof dataPoint?.name === "string",
				nameValid: typeof dataPoint?.name === "string" && dataPoint.name.length > 0,
				hasTime: dataPoint?.time instanceof Date,
				timeValid: dataPoint?.time ? !isNaN(dataPoint.time.getTime()) : false,
				hasValue: typeof dataPoint?.value === "number",
				valueValid: typeof dataPoint?.value === "number" && !isNaN(dataPoint.value),
				hasSource: typeof dataPoint?.source === "string",
				sourceValid: typeof dataPoint?.source === "string" && dataPoint.source.length > 0,
			});
		}

		return isValid;
	}

	private validateSignal(signal: Signal): boolean {
		const isValid = !!(
			signal &&
			signal.name &&
			signal.timestamp instanceof Date &&
			!isNaN(signal.timestamp.getTime()) &&
			typeof signal.value === "number" &&
			!isNaN(signal.value) &&
			signal.source
		);

		if (!isValid) {
			console.warn(`[SignalScheduler] Signal validation failed:`, {
				hasName: !!signal?.name,
				hasTimestamp: signal?.timestamp instanceof Date,
				timestampValid: signal?.timestamp ? !isNaN(signal.timestamp.getTime()) : false,
				hasValue: typeof signal?.value === "number",
				valueValid: typeof signal?.value === "number" && !isNaN(signal.value),
				hasSource: !!signal?.source,
			});
		}

		return isValid;
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
			console.warn(`[SignalScheduler] Unhealthy sources detected: ${unhealthySources.join(", ")}`);
		}

		// Log summary statistics
		const total = this.scheduledSources.size;
		const enabled = Array.from(this.scheduledSources.values()).filter((c) => c.enabled).length;
		const healthy = Array.from(this.scheduledSources.values()).filter((c) => this.isSourceHealthy(c)).length;

		console.log(`[SignalScheduler] Health check: ${healthy}/${enabled} healthy sources (${total} total registered)`);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
