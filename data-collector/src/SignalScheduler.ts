import cron from "node-cron";
import { DataSource } from "./datasources/Datasource";
import { MessageBroker } from "./services/messaging.interface";
import { Signal } from "./models/signal.interface";

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
				const signal = await config.source.fetch();

				if (signal) {
					// Validate signal before publishing
					if (this.validateSignal(signal as Signal)) {
						await this.messageBroker.publish("signals", "", signal);

						config.lastSuccess = new Date();
						config.consecutiveFailures = 0;

						const duration = Date.now() - startTime;
						console.log(`[SignalScheduler] Successfully collected ${sourceKey} in ${duration}ms`);
						return;
					} else {
						throw new Error("Invalid signal structure returned");
					}
				} else {
					console.warn(`[SignalScheduler] ${sourceKey} returned null signal`);
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

	private validateSignal(signal: Signal): boolean {
		return !!(
			signal &&
			signal.name &&
			signal.timestamp instanceof Date &&
			!isNaN(signal.timestamp.getTime()) &&
			typeof signal.value === "number" &&
			!isNaN(signal.value) &&
			signal.source
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
			"*/5 * * * *",
			() => {
				// Every 5 minutes
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
