import { DataSource } from "../datasources/datasources";
import { IndicatorDataPoint } from "./indicatorDataPoint";
import { MarketDataPoint } from "./marketDataPoint";

// union type that represents anything a DataSource can produce
export type DataSourceResult = MarketDataPoint | IndicatorDataPoint | (MarketDataPoint | IndicatorDataPoint)[];

// union type for supported message types
export type SupportedMessage = MarketDataPoint | IndicatorDataPoint;

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
