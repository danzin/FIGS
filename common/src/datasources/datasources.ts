import { MarketDataPoint } from "../models/marketDataPoint";
import { IndicatorDataPoint } from "../models/indicatorDataPoint";
import { NewsArticle } from "../models/newsArticle";

export type TaskResult =
	| MarketDataPoint
	| IndicatorDataPoint
	| NewsArticle
	| (MarketDataPoint | IndicatorDataPoint | NewsArticle)[];

export interface DataSource {
	key: string;
	fetch(): Promise<TaskResult | null>;
}
