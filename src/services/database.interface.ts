import { Signal } from "../models/signal.interface";

export interface DatabaseService {
	connect?(): Promise<void>;
	insertSignal(signal: Signal): Promise<void>;
	// getSignalsByName(name: string, limit: number): Promise<Signal[]>; // For a potential API service
	disconnect?(): Promise<void>;
}
