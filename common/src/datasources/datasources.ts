import { DataSourceResult } from "../models/data.interface";

export interface DataSource {
	// The unique key for the source instance (e.g., 'coingecko_bitcoin_price')
	key: string;

	// fetch() now returns the more specific union type
	fetch(): Promise<DataSourceResult | null>;
}
