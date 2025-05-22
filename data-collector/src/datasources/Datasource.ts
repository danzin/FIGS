import { Signal } from "../models/signal.interface";

export interface DataSource {
	/** Unique key for this data source */
	key: string;
	/** Fetch latest signal data */
	fetch(): Promise<Signal | Signal[] | null>;
}
