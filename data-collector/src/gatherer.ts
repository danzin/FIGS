import { DataSource } from "./datasources/Datasource";
import { Signal } from "./models/signal.interface";

export class Gatherer {
	private sources: DataSource[];
	constructor(sources: DataSource[]) {
		this.sources = sources;
	}

	/** Fetch all signals from each data source */
	public async collectAll(): Promise<Signal[]> {
		// logger.info('Starting data collection from all sources.');
		const results = await Promise.allSettled(this.sources.map((src) => src.fetch()));

		const signals: Signal[] = [];
		results.forEach((result, index) => {
			const sourceKey = this.sources[index].key;
			if (result.status === "fulfilled") {
				if (result.value) {
					// Check if fetch returned a valid signal (not null)
					signals.push(result.value as Signal);
					// logger.debug(`Successfully fetched signal from ${sourceKey}`);
				} else {
					// logger.warn(`Source ${sourceKey} returned null or no data.`);
					console.warn(`Source ${sourceKey} returned null or no data.`);
				}
			} else {
				// logger.error(`Failed to fetch signal from ${sourceKey}:`, { reason: result.reason });
				console.error(`Failed to fetch signal from ${sourceKey}:`, result.reason);
			}
		});
		// logger.info(`Collected ${signals.length} signals successfully.`);
		return signals;
	}
}
