import { useState, useEffect } from "react";
import { getLatestIndicators } from "../api/signalsApi";
import type { IndicatorData } from "../types/OhlcData";

const INDICATORS_TO_FETCH = ["^VIX", "fear_greed_index", "btc_dominance", "FRED_UNRATE", "SPY"];

function toCamel(s: string) {
	return s
		.replace(/[\^]/g, "") // drop funky chars
		.toLowerCase()
		.split(/[_\s-]+/)
		.map((word, i) => (i === 0 ? word : word[0].toUpperCase() + word.slice(1)))
		.join("");
}

export const useIndicatorsData = () => {
	const [indicators, setIndicators] = useState<Record<string, IndicatorData>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const data = await getLatestIndicators(INDICATORS_TO_FETCH);
				const normalized: Record<string, any> = {};
				Object.entries(data).forEach(([key, val]) => {
					normalized[toCamel(key)] = val;
				});
				console.log("Normalized indicators:", normalized);
				setIndicators(normalized);
			} catch (err: any) {
				console.error("Failed to fetch indicators:", err);
				setError("Could not load indicator data.");
			} finally {
				setIsLoading(false);
			}
		};

		fetchData(); // Fetch on mount
		const intervalId = setInterval(fetchData, 5 * 60 * 1000); // Refetch every 5 mins
		return () => clearInterval(intervalId);
	}, []);

	return { indicators, isLoading, error };
};
