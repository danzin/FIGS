import { MarketDataPoint } from "../models/marketDataPoint";
import { IndicatorDataPoint } from "../models/indicatorDataPoint";

// Constrain T so it’s either a MarketDataPoint or an IndicatorDataPoint
export interface DataSource<T extends MarketDataPoint | IndicatorDataPoint> {
	key: string;
	// now returns an array of exactly T
	fetch(): Promise<T[] | null>;
}
