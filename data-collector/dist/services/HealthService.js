"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const config_1 = require("../utils/config");
/**
 * HealthService provides methods to check the health of various components
 * in the data collector system, including the scheduler, message broker,
 * data sources, and memory usage.
 */
class HealthService {
    constructor(schedulerManager, messageBroker) {
        this.schedulerManager = schedulerManager;
        this.messageBroker = messageBroker;
    }
    async getSystemHealth() {
        const timestamp = new Date().toISOString();
        const schedulerHealth = this.checkSchedulerHealth();
        const messageBrokerHealth = await this.checkMessageBrokerHealth();
        const dataSourcesHealth = this.checkDataSourcesHealth();
        const memoryHealth = this.checkMemoryHealth();
        const components = [schedulerHealth, messageBrokerHealth, dataSourcesHealth, memoryHealth];
        const unhealthyCount = components.filter((c) => c.status === "unhealthy").length;
        const degradedCount = components.filter((c) => c.status === "degraded").length;
        let overallStatus;
        if (unhealthyCount > 2) {
            overallStatus = "unhealthy";
        }
        else if (degradedCount > 4) {
            overallStatus = "degraded";
        }
        else {
            overallStatus = "healthy";
        }
        const schedulerStatusSummary = this.schedulerManager.getScheduler().getStatus();
        return {
            status: overallStatus,
            timestamp,
            uptime: process.uptime(),
            components: {
                scheduler: schedulerHealth,
                messageBroker: messageBrokerHealth,
                dataSources: dataSourcesHealth,
                memory: memoryHealth,
            },
            summary: {
                total: schedulerStatusSummary.length,
                healthy: schedulerStatusSummary.filter((s) => s.isHealthy).length,
                degraded: schedulerStatusSummary.filter((s) => !s.isHealthy && s.enabled).length,
                failing: schedulerStatusSummary.filter((s) => s.consecutiveFailures > 0).length,
                enabled: schedulerStatusSummary.filter((s) => s.enabled).length,
            },
        };
    }
    checkSchedulerHealth() {
        try {
            const scheduler = this.schedulerManager.getScheduler();
            const status = scheduler.getStatus();
            if (status.length === 0) {
                return { status: "unhealthy", message: "No data sources registered", lastChecked: new Date().toISOString() };
            }
            const enabledSources = status.filter((s) => s.enabled);
            const healthyEnabledSources = enabledSources.filter((s) => s.isHealthy);
            const failingSources = status.filter((s) => s.consecutiveFailures > 0);
            const healthyPercentage = (healthyEnabledSources.length / enabledSources.length) * 100;
            if (enabledSources.length === 0) {
                return { status: "unhealthy", message: "No data sources enabled", lastChecked: new Date().toISOString() };
            }
            let componentStatus = "healthy";
            let message = `${healthyEnabledSources.length}/${enabledSources.length} enabled sources are healthy.`;
            if (healthyPercentage < 50) {
                componentStatus = "unhealthy";
                message = `Only ${healthyEnabledSources.length}/${enabledSources.length} enabled sources healthy.`;
            }
            else if (healthyPercentage < 80) {
                componentStatus = "degraded";
                message = `WARNING: ${healthyEnabledSources.length}/${enabledSources.length} enabled sources healthy.`;
            }
            return {
                status: componentStatus,
                message,
                details: {
                    totalRegistered: status.length,
                    totalEnabled: enabledSources.length,
                    healthyEnabled: healthyEnabledSources.length,
                    healthyPercentage: Math.round(healthyPercentage),
                    failingSources: enabledSources.filter((s) => s.consecutiveFailures > 0).map((s) => s.sourceKey),
                },
                lastChecked: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                status: "unhealthy",
                message: "Scheduler check failed",
                details: { error: error instanceof Error ? error.message : String(error) },
                lastChecked: new Date().toISOString(),
            };
        }
    }
    async checkMessageBrokerHealth() {
        try {
            const isConnected = this.messageBroker.isConnected();
            if (!isConnected) {
                return {
                    status: "unhealthy",
                    message: "Message broker not connected or channel unavailable",
                    lastChecked: new Date().toISOString(),
                };
            }
            return { status: "healthy", message: "Message broker connected", lastChecked: new Date().toISOString() };
        }
        catch (error) {
            return {
                status: "unhealthy",
                message: "Message broker health check failed",
                details: { error: error instanceof Error ? error.message : String(error) },
                lastChecked: new Date().toISOString(),
            };
        }
    }
    checkDataSourcesHealth() {
        try {
            const status = this.schedulerManager.getScheduler().getStatus();
            const now = new Date();
            const enabledSources = status.filter((s) => s.enabled);
            const criticalSources = enabledSources.filter((s) => s.consecutiveFailures >= 5);
            const staleSources = enabledSources.filter((s) => {
                if (!s.lastSuccess)
                    return true;
                const hoursSinceLastSuccess = (now.getTime() - s.lastSuccess.getTime()) / (1000 * 60 * 60);
                return hoursSinceLastSuccess > 24;
            });
            if (criticalSources.length > 0) {
                return {
                    status: "unhealthy",
                    message: `${criticalSources.length} enabled sources are critically failing (>= 5 consecutive failures).`,
                    details: { criticalSources: criticalSources.map((s) => s.sourceKey) },
                    lastChecked: new Date().toISOString(),
                };
            }
            if (staleSources.length > 0) {
                return {
                    status: "degraded",
                    message: `${staleSources.length} enabled sources have stale data (no success in >24h or ever).`,
                    details: { staleSources: staleSources.map((s) => s.sourceKey) },
                    lastChecked: new Date().toISOString(),
                };
            }
            return {
                status: "healthy",
                message: "All enabled data sources operating normally.",
                lastChecked: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                status: "unhealthy",
                message: "Data sources health check failed",
                details: { error: error instanceof Error ? error.message : String(error) },
                lastChecked: new Date().toISOString(),
            };
        }
    }
    checkMemoryHealth() {
        try {
            const memUsage = process.memoryUsage();
            const memUsageMB = {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024),
            };
            const HEAP_CRITICAL_THRESHOLD_MB = config_1.config.HEALTH_HEAP_CRITICAL_MB || 768;
            const HEAP_WARNING_THRESHOLD_MB = config_1.config.HEALTH_HEAP_WARNING_MB || 512;
            if (memUsageMB.heapUsed > HEAP_CRITICAL_THRESHOLD_MB) {
                return {
                    status: "unhealthy",
                    message: `Critical memory usage: ${memUsageMB.heapUsed}MB (Heap)`,
                    details: memUsageMB,
                    lastChecked: new Date().toISOString(),
                };
            }
            if (memUsageMB.heapUsed > HEAP_WARNING_THRESHOLD_MB) {
                return {
                    status: "degraded",
                    message: `High memory usage: ${memUsageMB.heapUsed}MB (Heap)`,
                    details: memUsageMB,
                    lastChecked: new Date().toISOString(),
                };
            }
            return {
                status: "healthy",
                message: `Memory usage normal: ${memUsageMB.heapUsed}MB (Heap)`,
                details: memUsageMB,
                lastChecked: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                status: "unhealthy",
                message: "Memory health check failed",
                details: { error: error instanceof Error ? error.message : String(error) },
                lastChecked: new Date().toISOString(),
            };
        }
    }
}
exports.HealthService = HealthService;
//# sourceMappingURL=HealthService.js.map