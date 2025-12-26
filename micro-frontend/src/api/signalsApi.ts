import axios from "axios";
import type { OhlcData, Interval } from "../types/OhlcData";
import type {
	IndicatorData,
	CorrelationData,
	RsiData,
	VolatilityState,
	MarketHeartbeatData,
} from "../types/Indicators";
import type { MetricChange } from "../types/MetricChange";
import { NewsItem } from "../types/NewsItem";

const apiClient = axios.create({
	baseURL: "/api/v1",
});

export const getOhlcData = async (assetSymbol: string, interval: Interval): Promise<OhlcData[]> => {
	const response = await apiClient.get<OhlcData[]>(`/assets/${assetSymbol}/ohlc`, {
		params: { interval },
	});
	return response.data;
};

export const getLatestIndicators = async (indicatorNames: string[]): Promise<Record<string, IndicatorData>> => {
	const response = await apiClient.get<Record<string, IndicatorData>>("/indicators/latest", {
		params: {
			names: indicatorNames.join(","),
		},
	});
	return response.data;
};

export const getAssetNames = async (): Promise<string[]> => {
	const { data } = await apiClient.get<string[]>("/assets");
	return data;
};

export const getMetricChange = async (
	metricName: string,
	changeType: "percent" | "absolute" = "percent"
): Promise<MetricChange> => {
	const response = await apiClient.get<MetricChange>(`/metric-change/${metricName}`, {
		params: { type: changeType },
	});
	return response.data;
};

export const getLatestNews = async (): Promise<NewsItem[]> => {
	const response = await apiClient.get<NewsItem[]>("/latest-news");
	return response.data;
};

// New Analytics API endpoints

export const getCorrelationMatrix = async (): Promise<CorrelationData> => {
	const response = await apiClient.get<CorrelationData>("/analytics/correlation");
	return response.data;
};

export const getRsiHeatmap = async (): Promise<RsiData[]> => {
	const response = await apiClient.get<RsiData[]>("/analytics/rsi-heatmap");
	return response.data;
};

export const getVolatilitySqueeze = async (assetSymbol: string): Promise<VolatilityState> => {
	const response = await apiClient.get<VolatilityState>(`/analytics/volatility-squeeze/${assetSymbol}`);
	return response.data;
};

export const getMarketHeartbeat = async (): Promise<MarketHeartbeatData> => {
	const response = await apiClient.get<MarketHeartbeatData>("/analytics/market-heartbeat");
	return response.data;
};

export const getWhaleMovements = async (assetSymbol: string): Promise<{ time: string; volume: number }[]> => {
	const response = await apiClient.get<{ time: string; volume: number }[]>(`/analytics/whale-movements/${assetSymbol}`);
	return response.data;
};

export interface OnChainMetricData {
	name: string;
	value: number;
	change?: number;
	unit: string;
}

export interface OnChainMetricsByAsset {
	btc: OnChainMetricData[];
	eth: OnChainMetricData[];
	sol: OnChainMetricData[];
}

export const getOnChainMetrics = async (): Promise<OnChainMetricsByAsset> => {
	const response = await apiClient.get<OnChainMetricsByAsset>("/analytics/onchain");
	return response.data;
};
