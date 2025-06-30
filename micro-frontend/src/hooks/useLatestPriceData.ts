import { useState, useEffect, useRef } from "react";
import { getLatestAssetPrice } from "../api/signalsApi";
import type { Signal } from "../types/OhlcData";

interface PriceData {
	brentCrudeOil: Signal | null;
}

interface UsePriceDataReturn {
	prices: PriceData;
	isLoading: boolean;
	error: string | null;
	lastUpdated: Date | null;
}

const PRICE_SIGNAL_NAMES = ["brent_crude_oil"];

const REFRESH_INTERVAL = 60 * 60 * 1000;

export const useLatestPriceData = (): UsePriceDataReturn => {
	const [prices, setPrices] = useState<PriceData>({
		brentCrudeOil: null,
	});

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchPriceData = async () => {
		try {
			setError(null);
			const response = await getLatestAssetPrice(PRICE_SIGNAL_NAMES);
			setPrices({
				brentCrudeOil: response["brent_crude_oil"] || null,
			});

			setLastUpdated(new Date());
		} catch (err) {
			console.error("Failed to fetch price data:", err);
			setError("Failed to load price data");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchPriceData();

		intervalRef.current = setInterval(fetchPriceData, REFRESH_INTERVAL);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);
	return {
		prices,
		isLoading,
		error,
		lastUpdated,
	};
};
