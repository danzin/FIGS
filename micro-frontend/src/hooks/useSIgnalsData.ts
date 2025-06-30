import { useState, useEffect, useRef } from "react";
import { getLatestMacroSignals } from "../api/signalsApi";
import type { Signal } from "../types/OhlcData";

interface MetricsData {
	fearGreed: Signal | null;
	vix: Signal | null;
	btcDominance: Signal | null;
	unemployment: Signal | null;
}

interface UseMetricsDataReturn {
	metrics: MetricsData;
	isLoading: boolean;
	error: string | null;
	lastUpdated: Date | null;
}

const METRICS_SIGNAL_NAMES = ["fear_greed_index", "vix_level", "coingecko_bitcoin_dominance", "FRED_UNRATE"];

const REFRESH_INTERVAL = 60 * 60 * 1000;

export const useSignalsData = (): UseMetricsDataReturn => {
	const [metrics, setMetrics] = useState<MetricsData>({
		fearGreed: null,
		vix: null,
		btcDominance: null,
		unemployment: null,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	// Use useRef to store the interval ID so it persists across re-renders
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchMetrics = async () => {
		try {
			setError(null);
			const response = await getLatestMacroSignals(METRICS_SIGNAL_NAMES);

			setMetrics({
				fearGreed: response["fear_greed_index"] || null,
				vix: response["vix_level"] || null,
				btcDominance: response["coingecko_bitcoin_dominance"] || null,
				unemployment: response["FRED_UNRATE"] || null,
			});

			setLastUpdated(new Date());
		} catch (err) {
			console.error("Failed to fetch metrics:", err);
			setError("Failed to load metrics data");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchMetrics();

		intervalRef.current = setInterval(fetchMetrics, REFRESH_INTERVAL);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);

	return {
		metrics,
		isLoading,
		error,
		lastUpdated,
	};
};
