import { MarketDataPoint } from "../models/marketDataPoint";
import { IndicatorDataPoint } from "../models/indicatorDataPoint";

export type TaskResult = MarketDataPoint | IndicatorDataPoint | (MarketDataPoint | IndicatorDataPoint)[];

export interface DataSource {
	key: string;
	fetch(): Promise<TaskResult | null>;
}
