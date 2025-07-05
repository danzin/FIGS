import { IndicatorDataPoint, MarketDataPoint, Signal } from "@financialsignalsgatheringsystem/common";

export interface DataSource {
	/** Unique key for this data source */
	key: string;
	/** Fetch latest data - can return MarketDataPoint array or single IndicatorDataPoint
	 * No more Signal.
	 */
	fetch(): Promise<MarketDataPoint[] | IndicatorDataPoint | null>;
}
