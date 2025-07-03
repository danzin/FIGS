import { HealthService } from "./services/HealthService";
import { SystemHealth, ComponentHealth } from "./models/health.interface";
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
export declare class SystemMonitor {
    private healthService;
    private healthHistory;
    private lastLoggedAlertState;
    private isMonitoring;
    private cronJobs;
    private readonly MAX_HISTORY_ENTRIES;
    private readonly LOG_STATE_CHANGE_COOLDOWN_MS;
    private readonly CHECK_INTERVAL_CRON;
    private readonly REPORT_INTERVAL_CRON;
    constructor(healthService: HealthService);
    startMonitoring(checkIntervalCron?: string): void;
    stopMonitoring(): void;
    getCurrentSystemHealth(): Promise<SystemHealth>;
    getRecentHealthHistory(entries?: number): HealthHistoryEntry[];
    getHealthStatistics(hours?: number): {
        totalChecks: number;
        healthyChecks: number;
        degradedChecks: number;
        unhealthyChecks: number;
        avgMemoryUsage: number;
        avgUptime: number;
    };
    private performAndProcessHealthCheck;
    private recordHealth;
    private evaluateAndLogAlerts;
    private evaluateOverallSystemHealth;
    private evaluateComponentHealth;
    private evaluateMetricThresholds;
    private logAlert;
    private formatComponentName;
    private generateAndLogHealthReport;
}
//# sourceMappingURL=SystemMonitor.d.ts.map