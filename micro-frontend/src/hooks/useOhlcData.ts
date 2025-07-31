import { useState, useEffect } from "react";
import { getOhlcData } from "../api/signalsApi";
import type { Interval, OhlcData } from "../types/OhlcData";

export const useOhlcData = (assetSymbol: string, interval: Interval) => {
	const [data, setData] = useState<OhlcData[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!assetSymbol) return;
		setLoading(true);
		setError(null);
		getOhlcData(assetSymbol, interval)
			.then((d) => setData(d))
			.catch((e) => {
				console.error("Failed to fetch chart data:", e);
				setError("Failed to load chart data.");
			})
			.finally(() => setLoading(false));
	}, [assetSymbol, interval]);

	return { data, loading, error };
};
