import { MarketDataPoint, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

// A scraper can return data that fits into either of our main tables
export type ScraperResult = IndicatorDataPoint | MarketDataPoint[] | null;

export interface Scraper {
	key: string;
	// The main execution method
	scrape(): Promise<IndicatorDataPoint | null>;
}
