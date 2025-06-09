import cron from "node-cron";
import { HealthService } from "./services/HealthService";
import { SystemHealth, ComponentHealth } from "./models/health.interface";
import { config } from "./utils/config";

export interface HealthHistoryEntry {
	timestamp: Date;
	overallStatus: SystemHealth["status"];
	componentStatuses: {
		scheduler: ComponentHealth["status"];
		messageBroker: ComponentHealth["status"];
		dataSources: ComponentHealth["status"];
		memory: ComponentHealth["status"];
	};
	metrics: {
		totalRegisteredSources: number;
		enabledSources: number;
		healthyEnabledSources: number;
		memoryUsageHeapUsedMB: number;
		uptimeSeconds: number;
	};
}

interface AlertData {
	title: string;
	message: string;
	details: any;
	severity: "info" | "warning" | "critical";
}

interface AlertState {
	status: string;
	timestamp: Date;
}

export class SystemMonitor {
	private healthService: HealthService;
	private healthHistory: HealthHistoryEntry[] = [];
	private lastLoggedAlertState: Map<string, AlertState> = new Map();
	private isMonitoring: boolean = false;
	private cronJobs: cron.ScheduledTask[] = [];

	private readonly MAX_HISTORY_ENTRIES = 1440;
	private readonly LOG_STATE_CHANGE_COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes
	private readonly CHECK_INTERVAL_CRON = config.MONITOR_CHECK_INTERVAL_CRON || "*/45 * * * *"; // Default every 45 mins
	private readonly REPORT_INTERVAL_CRON = "0 * * * *"; // Hourly reports

	constructor(healthService: HealthService) {
		this.healthService = healthService;

		// Graceful shutdown handling
		process.on("SIGINT", () => this.stopMonitoring());
		process.on("SIGTERM", () => this.stopMonitoring());
	}

	public startMonitoring(checkIntervalCron = this.CHECK_INTERVAL_CRON): void {
		if (this.isMonitoring) {
			console.warn("[SystemMonitor] Monitoring is already active.");
			return;
		}

		console.log(`[SystemMonitor] Starting system monitoring (check interval: ${checkIntervalCron})...`);
		this.isMonitoring = true;

		// Health check cron job
		const healthCheckJob = cron.schedule(
			checkIntervalCron,
			async () => {
				if (!this.isMonitoring) return;
				await this.performAndProcessHealthCheck();
			},
			{ scheduled: true, timezone: "UTC" }
		);

		// Hourly report cron job
		const reportJob = cron.schedule(
			this.REPORT_INTERVAL_CRON,
			() => {
				if (!this.isMonitoring) return;
				this.generateAndLogHealthReport();
			},
			{ scheduled: true, timezone: "UTC" }
		);

		this.cronJobs.push(healthCheckJob, reportJob);
		console.log("[SystemMonitor] Monitoring started successfully.");

		// Perform initial health check with 5sec delay
		setTimeout(() => {
			this.performAndProcessHealthCheck().catch((error) => {
				console.error("[SystemMonitor] Initial health check failed:", error);
			});
		}, 5000);
	}

	public stopMonitoring(): void {
		if (!this.isMonitoring) return;

		console.log("[SystemMonitor] Stopping system monitoring...");
		this.isMonitoring = false;

		// Properly destroy all cron jobs
		this.cronJobs.forEach((job) => {
			try {
				job.stop();
			} catch (error) {
				console.warn("[SystemMonitor] Error destroying cron job:", error);
			}
		});
		this.cronJobs = [];

		console.log("[SystemMonitor] Monitoring stopped.");
	}

	public async getCurrentSystemHealth(): Promise<SystemHealth> {
		return this.healthService.getSystemHealth();
	}

	public getRecentHealthHistory(entries: number = 12): HealthHistoryEntry[] {
		return this.healthHistory.slice(-Math.max(1, entries));
	}

	public getHealthStatistics(hours: number = 1): {
		totalChecks: number;
		healthyChecks: number;
		degradedChecks: number;
		unhealthyChecks: number;
		avgMemoryUsage: number;
		avgUptime: number;
	} {
		const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
		const recentEntries = this.healthHistory.filter((entry) => entry.timestamp >= cutoffTime);

		if (recentEntries.length === 0) {
			return {
				totalChecks: 0,
				healthyChecks: 0,
				degradedChecks: 0,
				unhealthyChecks: 0,
				avgMemoryUsage: 0,
				avgUptime: 0,
			};
		}

		const stats = recentEntries.reduce(
			(acc, entry) => {
				acc[entry.overallStatus]++;
				acc.totalMemory += entry.metrics.memoryUsageHeapUsedMB;
				acc.totalUptime += entry.metrics.uptimeSeconds;
				return acc;
			},
			{
				healthy: 0,
				degraded: 0,
				unhealthy: 0,
				totalMemory: 0,
				totalUptime: 0,
			}
		);

		return {
			totalChecks: recentEntries.length,
			healthyChecks: stats.healthy,
			degradedChecks: stats.degraded,
			unhealthyChecks: stats.unhealthy,
			avgMemoryUsage: Math.round(stats.totalMemory / recentEntries.length),
			avgUptime: Math.round(stats.totalUptime / recentEntries.length),
		};
	}

	private async performAndProcessHealthCheck(): Promise<void> {
		try {
			const currentHealth = await this.getCurrentSystemHealth();
			this.recordHealth(currentHealth);
			this.evaluateAndLogAlerts(currentHealth);
		} catch (error) {
			console.error("[SystemMonitor] Error during scheduled health check:", error);

			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logAlert("HEALTH_CHECK_FAILURE", {
				title: "🚨 System Monitor Health Check Failed",
				message: "The health check process itself encountered an error. Investigation needed.",
				details: {
					error: errorMessage,
					timestamp: new Date().toISOString(),
					stack: error instanceof Error ? error.stack : undefined,
				},
				severity: "critical",
			});
		}
	}

	private recordHealth(health: SystemHealth): void {
		try {
			const memoryDetails = health.components.memory.details as { heapUsed: number } | undefined;
			const entry: HealthHistoryEntry = {
				timestamp: new Date(health.timestamp),
				overallStatus: health.status,
				componentStatuses: {
					scheduler: health.components.scheduler.status,
					messageBroker: health.components.messageBroker.status,
					dataSources: health.components.dataSources.status,
					memory: health.components.memory.status,
				},
				metrics: {
					totalRegisteredSources: health.summary.total,
					enabledSources: health.summary.enabled,
					healthyEnabledSources: health.summary.healthy,
					memoryUsageHeapUsedMB: Math.round((memoryDetails?.heapUsed || 0) / (1024 * 1024)), // Convert to MB
					uptimeSeconds: health.uptime,
				},
			};

			this.healthHistory.push(entry);

			// Maintain history size limit
			if (this.healthHistory.length > this.MAX_HISTORY_ENTRIES) {
				this.healthHistory.splice(0, this.healthHistory.length - this.MAX_HISTORY_ENTRIES);
			}
		} catch (error) {
			console.error("[SystemMonitor] Error recording health data:", error);
		}
	}

	private evaluateAndLogAlerts(health: SystemHealth): void {
		const createAlertData = (
			title: string,
			message: string,
			details: any,
			severity: "info" | "warning" | "critical"
		): AlertData => ({
			title,
			message,
			details,
			severity,
		});

		// Evaluate overall system health
		this.evaluateOverallSystemHealth(health, createAlertData);

		// Evaluate individual components
		this.evaluateComponentHealth(health, createAlertData);

		// Check for potential issues based on metrics
		this.evaluateMetricThresholds(health, createAlertData);
	}

	private evaluateOverallSystemHealth(health: SystemHealth, createAlertData: Function): void {
		const currentStatus = health.status;
		const lastOverallState = this.lastLoggedAlertState.get("SYSTEM_OVERALL_STATUS");

		if (currentStatus === "unhealthy") {
			this.logAlert(
				"SYSTEM_UNHEALTHY",
				createAlertData(
					"🚨 System Health Critical",
					`System is unhealthy. Components: Scheduler(${health.components.scheduler.status}), MessageBroker(${health.components.messageBroker.status}), DataSources(${health.components.dataSources.status}), Memory(${health.components.memory.status})`,
					{
						overallStatus: health.status,
						components: health.components,
						summary: health.summary,
					},
					"critical"
				)
			);
		} else if (currentStatus === "degraded") {
			this.logAlert(
				"SYSTEM_DEGRADED",
				createAlertData(
					"⚠️ System Health Degraded",
					`System performance is degraded. Components: Scheduler(${health.components.scheduler.status}), MessageBroker(${health.components.messageBroker.status}), DataSources(${health.components.dataSources.status}), Memory(${health.components.memory.status})`,
					{
						overallStatus: health.status,
						components: health.components,
						summary: health.summary,
					},
					"warning"
				)
			);
		} else if (currentStatus === "healthy") {
			// Log recovery if previous state was problematic
			if (lastOverallState && lastOverallState.status !== "healthy") {
				this.logAlert(
					"SYSTEM_RECOVERED",
					createAlertData(
						"✅ System Recovered",
						`System has recovered and is now healthy (was: ${lastOverallState.status})`,
						{
							previousStatus: lastOverallState.status,
							currentStatus: "healthy",
							recoveryTime: new Date().toISOString(),
						},
						"info"
					),
					true // Force log recovery
				);
			}
		}

		// Update overall system status tracking
		this.lastLoggedAlertState.set("SYSTEM_OVERALL_STATUS", {
			status: currentStatus,
			timestamp: new Date(),
		});
	}

	private evaluateComponentHealth(health: SystemHealth, createAlertData: Function): void {
		Object.entries(health.components).forEach(([componentName, componentHealth]) => {
			const componentKey = `${componentName.toUpperCase()}_STATE`;
			const lastComponentState = this.lastLoggedAlertState.get(componentKey);
			const currentStatus = componentHealth.status;

			if (currentStatus === "unhealthy") {
				this.logAlert(
					`${componentName.toUpperCase()}_UNHEALTHY`,
					createAlertData(
						`🚨 ${this.formatComponentName(componentName)} Critical`,
						componentHealth.message ||
							`${this.formatComponentName(componentName)} is unhealthy and requires immediate attention.`,
						{
							component: componentName,
							status: currentStatus,
							...componentHealth.details,
						},
						"critical"
					)
				);
			} else if (currentStatus === "degraded") {
				this.logAlert(
					`${componentName.toUpperCase()}_DEGRADED`,
					createAlertData(
						`⚠️ ${this.formatComponentName(componentName)} Degraded`,
						componentHealth.message || `${this.formatComponentName(componentName)} performance is degraded.`,
						{
							component: componentName,
							status: currentStatus,
							...componentHealth.details,
						},
						"warning"
					)
				);
			} else if (currentStatus === "healthy") {
				// Log recovery if component was previously unhealthy/degraded
				if (lastComponentState && lastComponentState.status !== "healthy") {
					this.logAlert(
						`${componentName.toUpperCase()}_RECOVERED`,
						createAlertData(
							`✅ ${this.formatComponentName(componentName)} Recovered`,
							`${this.formatComponentName(componentName)} has recovered and is now healthy (was: ${lastComponentState.status})`,
							{
								component: componentName,
								previousStatus: lastComponentState.status,
								currentStatus: "healthy",
								recoveryTime: new Date().toISOString(),
							},
							"info"
						),
						true // Force log recovery
					);
				}
			}

			// Update component state tracking
			this.lastLoggedAlertState.set(componentKey, {
				status: currentStatus,
				timestamp: new Date(),
			});
		});
	}

	private evaluateMetricThresholds(health: SystemHealth, createAlertData: Function): void {
		// Memory usage threshold (configurable)
		const memoryThresholdMB = config.HEALTH_HEAP_WARNING_MB || 512;
		const memoryDetails = health.components.memory.details as { heapUsed: number } | undefined;
		const memoryUsageMB = Math.round((memoryDetails?.heapUsed || 0) / (1024 * 1024));

		if (memoryUsageMB > memoryThresholdMB) {
			this.logAlert(
				"HIGH_MEMORY_USAGE",
				createAlertData(
					"⚠️ High Memory Usage",
					`Memory usage (${memoryUsageMB}MB) exceeds threshold (${memoryThresholdMB}MB)`,
					{
						currentUsageMB: memoryUsageMB,
						thresholdMB: memoryThresholdMB,
						percentageOfThreshold: Math.round((memoryUsageMB / memoryThresholdMB) * 100),
					},
					"warning"
				)
			);
		}

		// Data source health ratio
		const healthyRatio = health.summary.enabled > 0 ? health.summary.healthy / health.summary.enabled : 1;
		const minHealthyRatio = 0.6;

		if (healthyRatio < minHealthyRatio && health.summary.enabled > 0) {
			this.logAlert(
				"LOW_SOURCE_HEALTH_RATIO",
				createAlertData(
					"⚠️ Low Data Source Health Ratio",
					`Only ${health.summary.healthy}/${health.summary.enabled} data sources are healthy (${Math.round(healthyRatio * 100)}%)`,
					{
						healthySources: health.summary.healthy,
						enabledSources: health.summary.enabled,
						totalSources: health.summary.total,
						healthyRatio: Math.round(healthyRatio * 100),
						thresholdRatio: Math.round(minHealthyRatio * 100),
					},
					"warning"
				)
			);
		}
	}

	private logAlert(alertKey: string, alertData: AlertData, forceLog: boolean = false): void {
		const now = new Date();
		const lastLog = this.lastLoggedAlertState.get(alertKey);
		const currentState = `${alertData.severity}`;

		// Check cooldown unless forced
		if (!forceLog && lastLog && lastLog.status === currentState) {
			const timeSinceLastLog = now.getTime() - lastLog.timestamp.getTime();
			if (timeSinceLastLog < this.LOG_STATE_CHANGE_COOLDOWN_MS) {
				return; // Skip logging due to cooldown
			}
		}

		// Log the alert
		const logMessage = `[SystemMonitor] [${alertData.severity.toUpperCase()}] ${alertData.title}: ${alertData.message}`;

		switch (alertData.severity) {
			case "critical":
				console.error(logMessage);
				if (alertData.details) {
					console.error("Details:", JSON.stringify(alertData.details, null, 2));
				}
				break;
			case "warning":
				console.warn(logMessage);
				if (alertData.details) {
					console.warn("Details:", JSON.stringify(alertData.details, null, 2));
				}
				break;
			case "info":
				console.info(logMessage);
				if (alertData.details) {
					console.info("Details:", JSON.stringify(alertData.details, null, 2));
				}
				break;
		}

		// Update alert state tracking
		this.lastLoggedAlertState.set(alertKey, {
			status: currentState,
			timestamp: now,
		});
	}

	private formatComponentName(componentName: string): string {
		return componentName
			.replace(/([A-Z])/g, " $1")
			.replace(/^./, (str) => str.toUpperCase())
			.trim();
	}

	private generateAndLogHealthReport(): void {
		const currentHealth = this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1] : null;

		if (!currentHealth) {
			console.info("[SystemMonitor] No health data available for hourly report.");
			return;
		}

		const stats = this.getHealthStatistics(1); // Last hour statistics
		const uptimeHours = currentHealth.metrics.uptimeSeconds / 3600;
		const uptimeDisplay =
			uptimeHours >= 24
				? `${Math.floor(uptimeHours / 24)}d ${Math.floor(uptimeHours % 24)}h`
				: `${uptimeHours.toFixed(1)}h`;

		console.info("\n[SystemMonitor] ===== HOURLY HEALTH SUMMARY =====");
		console.info(`Timestamp: ${currentHealth.timestamp.toISOString()}`);
		console.info(`Overall Status: ${currentHealth.overallStatus.toUpperCase()}`);
		console.info(`System Uptime: ${uptimeDisplay}`);
		console.info(`Memory Usage: ${currentHealth.metrics.memoryUsageHeapUsedMB} MB`);
		console.info(
			`Data Sources: ${currentHealth.metrics.healthyEnabledSources}/${currentHealth.metrics.enabledSources} healthy (${currentHealth.metrics.totalRegisteredSources} total)`
		);
		console.info(`Components Status:`);
		console.info(`  └─ Scheduler: ${currentHealth.componentStatuses.scheduler}`);
		console.info(`  └─ Message Broker: ${currentHealth.componentStatuses.messageBroker}`);
		console.info(`  └─ Data Sources: ${currentHealth.componentStatuses.dataSources}`);
		console.info(`  └─ Memory: ${currentHealth.componentStatuses.memory}`);

		if (stats.totalChecks > 0) {
			const healthPercentage = Math.round((stats.healthyChecks / stats.totalChecks) * 100);
			console.info(`Last Hour Stats: ${healthPercentage}% healthy (${stats.totalChecks} checks)`);
		}

		console.info("=======================================\n");
	}
}
