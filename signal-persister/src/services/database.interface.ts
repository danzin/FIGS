import { Signal } from "@financialsignalsgatheringsystem/common";
import { MarketDataPoint, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";
export interface DatabaseService {
	connect?(): Promise<void>; // Optional if connection is managed by pool instantiation
	insertSignal?(signal: Signal): Promise<void>;
	insertIndicator?(point: IndicatorDataPoint): Promise<void>;
	insertMarketData?(point: MarketDataPoint): Promise<void>;
	// getSignalsByName(name: string, limit: number): Promise<Signal[]>; // For a potential API service
	disconnect?(): Promise<void>; // Optional if pool handles this on process exit
}
