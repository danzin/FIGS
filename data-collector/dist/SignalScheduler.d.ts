import { DataSource } from "./datasources/Datasource";
import { MessageBroker } from "@financialsignalsgatheringsystem/common";
export interface ScheduledDataSource {
    source: DataSource;
    schedule: string;
    enabled: boolean;
    priority: "high" | "medium" | "low";
    maxRetries: number;
    retryDelay: number;
    lastRun?: Date;
    lastSuccess?: Date;
    consecutiveFailures: number;
}
export declare class SignalScheduler {
    private scheduledSources;
    private activeTasks;
    private messageBroker;
    private isRunning;
    constructor(messageBroker: MessageBroker);
    /**
     * Register a data source with scheduling configuration
     */
    registerSource(config: ScheduledDataSource): void;
    /**
     * Remove a data source from scheduling
     */
    unregisterSource(sourceKey: string): void;
    /**
     * Start all scheduled data collection tasks
     */
    start(): void;
    /**
     * Stop all scheduled tasks
     */
    stop(): void;
    /**
     * Manually trigger a specific data source
     */
    triggerSource(sourceKey: string): Promise<void>;
    /**
     * Get status of all scheduled sources
     */
    getStatus(): Array<{
        sourceKey: string;
        enabled: boolean;
        schedule: string;
        lastRun?: Date;
        lastSuccess?: Date;
        consecutiveFailures: number;
        isHealthy: boolean;
    }>;
    private scheduleSource;
    private collectSignal;
    private validateSignal;
    private isSourceHealthy;
    private startHealthMonitoring;
    private performHealthCheck;
    private sleep;
}
//# sourceMappingURL=SignalScheduler.d.ts.map