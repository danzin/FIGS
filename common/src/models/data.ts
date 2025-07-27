import { DataSource } from "../datasources/datasources";
import { IndicatorDataPoint } from "./indicatorDataPoint";
import { MarketDataPoint } from "./marketDataPoint";
import { NewsArticle } from "./newsArticle";

// union type that represents anything a DataSource can produce
export type DataSourceResult =
	| MarketDataPoint
	| IndicatorDataPoint
	| NewsArticle
	| (MarketDataPoint | NewsArticle | IndicatorDataPoint)[];

// union type for supported message types
export type SupportedMessage = MarketDataPoint | IndicatorDataPoint | NewsArticle;

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
