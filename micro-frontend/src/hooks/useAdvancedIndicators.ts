import { useState, useEffect, useCallback } from "react";
import {
	getPowerLawData,
	getStablecoinLiquidity,
	getOpenInterest,
	getMomentumCoalescence,
	getMVRVData,
	getHashRateData,
	getCompositeIndicator,
	getCVDData,
} from "../api/indicatorsApi";
import type {
	PowerLawData,
	StablecoinLiquidityData,
	OpenInterestData,
	MomentumCoalescenceData,
	MVRVData,
	HashRateData,
	CompositeIndicatorData,
	CVDData,
} from "../types/AdvancedIndicators";

// Hook for Power Law Model
export const usePowerLaw = () => {
	const [data, setData] = useState<PowerLawData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getPowerLawData();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch power law data:", err);
			setError("Failed to load power law data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 60 * 60 * 1000); // Refresh hourly
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for Stablecoin Liquidity
export const useStablecoinLiquidity = () => {
	const [data, setData] = useState<StablecoinLiquidityData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getStablecoinLiquidity();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch stablecoin liquidity:", err);
			setError("Failed to load stablecoin data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 15 * 60 * 1000); // Refresh every 15 min
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for Open Interest
export const useOpenInterest = () => {
	const [data, setData] = useState<OpenInterestData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getOpenInterest();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch open interest:", err);
			setError("Failed to load open interest data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 5 * 60 * 1000); // Refresh every 5 min
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for Momentum Coalescence
export const useMomentumCoalescence = () => {
	const [data, setData] = useState<MomentumCoalescenceData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getMomentumCoalescence();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch momentum coalescence:", err);
			setError("Failed to load momentum data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for MVRV Z-Score
export const useMVRV = () => {
	const [data, setData] = useState<MVRVData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getMVRVData();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch MVRV data:", err);
			setError("Failed to load MVRV data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 60 * 60 * 1000); // Refresh hourly
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for Hash Rate
export const useHashRate = () => {
	const [data, setData] = useState<HashRateData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getHashRateData();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch hash rate:", err);
			setError("Failed to load hash rate data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 60 * 60 * 1000); // Refresh hourly
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for Composite Indicator
export const useCompositeIndicator = () => {
	const [data, setData] = useState<CompositeIndicatorData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getCompositeIndicator();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch composite indicator:", err);
			setError("Failed to load composite data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};

// Hook for CVD
export const useCVD = () => {
	const [data, setData] = useState<CVDData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await getCVDData();
			setData(result);
		} catch (err) {
			console.error("Failed to fetch CVD data:", err);
			setError("Failed to load CVD data");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, 60 * 1000); // Refresh every minute for real-time
		return () => clearInterval(interval);
	}, [fetchData]);

	return { data, isLoading, error, refetch: fetchData };
};
