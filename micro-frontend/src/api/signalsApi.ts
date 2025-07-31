import axios from "axios";
import type { OhlcData, Interval } from "../types/OhlcData";
import type { IndicatorData } from "../types/Indicators";
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
