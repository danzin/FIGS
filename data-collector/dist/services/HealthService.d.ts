import { SchedulerConfigManager } from "../SchedulerConfigManager";
import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { SystemHealth } from "../models/health.interface";
/**
 * HealthService provides methods to check the health of various components
 * in the data collector system, including the scheduler, message broker,
 * data sources, and memory usage.
 */
export declare class HealthService {
    private schedulerManager;
    private messageBroker;
    constructor(schedulerManager: SchedulerConfigManager, messageBroker: RabbitMQService);
    getSystemHealth(): Promise<SystemHealth>;
    private checkSchedulerHealth;
    private checkMessageBrokerHealth;
    private checkDataSourcesHealth;
    private checkMemoryHealth;
}
//# sourceMappingURL=HealthService.d.ts.map