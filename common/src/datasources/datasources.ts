import { MarketDataPoint } from "../models/marketDataPoint";
import { IndicatorDataPoint } from "../models/indicatorDataPoint";
import { NewsArticle } from "../models/newsArticle";
import { MacroRawArticle } from "../models/macroRawArticle";

export type TaskResult =
	| MarketDataPoint
	| IndicatorDataPoint
	| NewsArticle
	| MacroRawArticle
	| (MarketDataPoint | IndicatorDataPoint | NewsArticle | MacroRawArticle)[];

export interface DataSource {
	key: string;
	fetch(): Promise<TaskResult | null>;
}
