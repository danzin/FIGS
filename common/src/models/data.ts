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

// Type guards using unique structural discriminators for each SupportedMessage member.
// These replace unsafe `as any` casts when narrowing the union.
export const isMarketDataPoint = (msg: SupportedMessage): msg is MarketDataPoint =>
	'asset_symbol' in msg;

// NewsArticle uses camelCase `publishedAt`; MacroRawArticle uses snake_case `published_at`
export const isNewsArticle = (msg: SupportedMessage): msg is NewsArticle =>
	'publishedAt' in msg;

export const isMacroRawArticle = (msg: SupportedMessage): msg is MacroRawArticle =>
	'content_hash' in msg;

export const isMacroEvent = (msg: SupportedMessage): msg is MacroEvent =>
	'event_type' in msg;

export const isMacroScenarioReport = (msg: SupportedMessage): msg is MacroScenarioReport =>
	'report_text' in msg;

export const isMacroAnalysisRun = (msg: SupportedMessage): msg is MacroAnalysisRun =>
	'methodology' in msg;

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
