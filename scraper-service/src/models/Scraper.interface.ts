import { MarketDataPoint, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

export type ScraperResult = IndicatorDataPoint | MarketDataPoint[] | null;

export interface Scraper {
	key: string;
	// The main execution method
	scrape(): Promise<MarketDataPoint[] | null>;
}
