import { SignalScheduler, ScheduledDataSource } from "./SignalScheduler";
import { MessageBroker } from "@financialsignalsgatheringsystem/common";
export declare class SchedulerConfigManager {
    private scheduler;
    constructor(messageBroker: MessageBroker);
    setupDefaultSchedules(): void;
    setupMarketHoursAwareSchedules(): void;
    addCustomSchedule(source: any, cronExpression: string, options?: Partial<ScheduledDataSource>): void;
    getScheduler(): SignalScheduler;
    private registerHighFrequencySource;
    private registerMediumFrequencySource;
    private registerLowFrequencySource;
}
export declare const CRON_EXAMPLES: {
    EVERY_5_MIN: string;
    EVERY_10_MIN: string;
    EVERY_15_MIN: string;
    EVERY_30_MIN: string;
    EVERY_HOUR: string;
    EVERY_2_HOURS: string;
    EVERY_4_HOURS: string;
    DAILY_9AM_UTC: string;
    DAILY_MIDNIGHT_UTC: string;
    WEEKDAYS_9AM: string;
    US_MARKET_HOURS_15MIN: string;
    US_MARKET_HOURS_30MIN: string;
    WEEKLY_MONDAY_9AM: string;
    MONTHLY_FIRST_9AM: string;
};
//# sourceMappingURL=SchedulerConfigManager.d.ts.map