import { IndicatorDataPoint } from "./indicatorDataPoint";
import { MarketDataPoint } from "./marketDataPoint";

// union type that represents anything a DataSource can produce
export type DataSourceResult = MarketDataPoint | IndicatorDataPoint | (MarketDataPoint | IndicatorDataPoint)[];
