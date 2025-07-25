import axios from "axios";
import type { OhlcData, Interval } from "../types/OhlcData";
import type { IndicatorData } from "../types/Indicators";
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
