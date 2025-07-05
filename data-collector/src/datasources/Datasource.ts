import { IndicatorDataPoint, MarketDataPoint, Signal } from "@financialsignalsgatheringsystem/common";

export interface DataSource {
	/** Unique key for this data source */
	key: string;
	/** Fetch latest data - can return Signal (legacy), MarketDataPoint array, or single IndicatorDataPoint */
	fetch(): Promise<Signal | MarketDataPoint[] | IndicatorDataPoint | null>;
}
