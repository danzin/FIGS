import axios from "axios";
import type { OhlcData, Interval, IndicatorData } from "../types/OhlcData";

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
			names: indicatorNames.join(","), // Join array into comma-separated string for URL param
		},
	});
	return response.data;
};
