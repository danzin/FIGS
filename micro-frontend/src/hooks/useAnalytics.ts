import { useState, useEffect, useCallback } from "react";
import {
	getCorrelationMatrix,
	getRsiHeatmap,
	getVolatilitySqueeze,
	getMarketHeartbeat,
	getWhaleMovements,
	getOnChainMetrics,
	type OnChainMetricsByAsset,
} from "../api/signalsApi";
import type { CorrelationData, RsiData, VolatilityState, MarketHeartbeatData } from "../types/Indicators";

// Hook for Correlation Matrix
export const useCorrelationMatrix = () => {
	const [data, setData] = useState<CorrelationData>({ assets: [], matrix: [] });
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getCorrelationMatrix();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch correlation matrix:", err);
			setError("Failed to load correlation data");
			// Fallback mock data for demo
			setData({
				assets: ["BTC", "ETH", "SPY", "GOLD"],
				matrix: [
					[1.0, 0.85, 0.45, 0.12],
					[0.85, 1.0, 0.38, 0.08],
					[0.45, 0.38, 1.0, -0.15],
					[0.12, 0.08, -0.15, 1.0],
				],
			});
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		// Refresh every hour
		const interval = setInterval(fetchData, 60 * 60 * 1000);
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for RSI Heatmap
export const useRsiHeatmap = () => {
	const [data, setData] = useState<RsiData[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getRsiHeatmap();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch RSI heatmap:", err);
			setError("Failed to load RSI data");
			// Fallback mock data for demo
			setData([
				{ symbol: "bitcoin", name: "Bitcoin", rsi: 28, price: 42500, priceChange24h: -2.5 },
				{ symbol: "ethereum", name: "Ethereum", rsi: 35, price: 2250, priceChange24h: -1.8 },
				{ symbol: "solana", name: "Solana", rsi: 45, price: 98, priceChange24h: 0.5 },
				{ symbol: "cardano", name: "Cardano", rsi: 55, price: 0.52, priceChange24h: 1.2 },
				{ symbol: "ripple", name: "XRP", rsi: 72, price: 0.62, priceChange24h: 5.3 },
			]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		// Refresh every 5 minutes
		const interval = setInterval(fetchData, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for Volatility Squeeze
export const useVolatilitySqueeze = (assetSymbol: string) => {
	const [data, setData] = useState<VolatilityState | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		if (!assetSymbol) return;
		setIsLoading(true);
		setError(null);
		try {
			const result = await getVolatilitySqueeze(assetSymbol);
			setData(result);
		} catch (err) {
			console.error("Failed to fetch volatility squeeze:", err);
			setError("Failed to load volatility data");
			// Fallback mock data
			setData({
				status: "squeeze",
				bandWidth: 0.05,
				bandWidthPercentile: 15,
				upperBand: 44000,
				lowerBand: 41000,
				currentPrice: 42500,
			});
		} finally {
			setIsLoading(false);
		}
	}, [assetSymbol]);

	useEffect(() => {
		fetchData();
		// Refresh every 5 minutes
		const interval = setInterval(fetchData, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for Market Heartbeat
export const useMarketHeartbeat = () => {
	const [data, setData] = useState<MarketHeartbeatData>({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getMarketHeartbeat();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch market heartbeat:", err);
			setError("Failed to load market data");
			// Fallback mock data
			setData({
				btcPrice: { value: 42500, change: 2.5 },
				ethPrice: { value: 2250, change: 1.8 },
				btcDominance: { value: 52.3, change: 0.5 },
				ethGas: { value: 25, status: "medium" },
				totalMarketCap: { value: 1.75e12, change: 1.2 },
				fearGreed: { value: 45, label: "Fear" },
			});
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		// Refresh every minute
		const interval = setInterval(fetchData, 60 * 1000);
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for Whale Movements
export const useWhaleMovements = (assetSymbol: string) => {
	const [data, setData] = useState<{ time: string; volume: number }[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		if (!assetSymbol) return;
		setIsLoading(true);
		setError(null);
		try {
			const result = await getWhaleMovements(assetSymbol);
			setData(result);
		} catch (err) {
			console.error("Failed to fetch whale movements:", err);
			setError("Failed to load whale data");
			setData([]);
		} finally {
			setIsLoading(false);
		}
	}, [assetSymbol]);

	useEffect(() => {
		fetchData();
		// Refresh every 15 minutes
		const interval = setInterval(fetchData, 15 * 60 * 1000);
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for On-Chain Metrics
export const useOnChainMetrics = () => {
	const [data, setData] = useState<OnChainMetricsByAsset>({ btc: [], eth: [], sol: [] });
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getOnChainMetrics();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch on-chain metrics:", err);
			setError("Failed to load on-chain data");
			setData({ btc: [], eth: [], sol: [] });
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		// Refresh every 5 minutes
		const interval = setInterval(fetchData, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};
