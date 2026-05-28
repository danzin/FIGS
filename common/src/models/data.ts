import { DataSource } from "../datasources/datasources";
import { IndicatorDataPoint } from "./indicatorDataPoint";
import { MarketDataPoint } from "./marketDataPoint";
import { NewsArticle } from "./newsArticle";
import { MacroRawArticle } from "./macroRawArticle";
import { MacroEvent } from "./macroEvent";
import { MacroAnalysisRun } from "./macroAnalysis";
import { MacroScenarioReport } from "./macroScenarioReport";

// union type that represents anything a DataSource can produce
export type DataSourceResult =
	| MarketDataPoint
	| IndicatorDataPoint
	| NewsArticle
	| MacroRawArticle
	| MacroEvent
	| MacroAnalysisRun
	| MacroScenarioReport
	| (MarketDataPoint | NewsArticle | IndicatorDataPoint | MacroRawArticle | MacroEvent | MacroAnalysisRun | MacroScenarioReport)[];

// union type for supported message types
export type SupportedMessage = 
	| MarketDataPoint 
	| IndicatorDataPoint 
	| NewsArticle
	| MacroRawArticle
	| MacroEvent
	| MacroAnalysisRun
	| MacroScenarioReport;

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
