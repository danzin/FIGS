import axios from "axios";
import qs from "qs";

import type { OhlcData, Signal, Interval, PriceDTO } from "../types/OhlcData";

const apiClient = axios.create({
	baseURL: "/api/v1",
	paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "comma" }),
});

export const getOhlcData = async (baseName: string, interval: Interval): Promise<OhlcData[]> => {
	const response = await apiClient.get<OhlcData[]>(`/assets/${baseName}/ohlc/`, { params: { interval: interval } });
	return response.data;
};

//eg, request 'api/v1/signals/latest/?names=fear_greed_index,FRED_M2SL'
export const getLatestMacroSignals = async (signalNames: string[]): Promise<Record<string, Signal>> => {
	const response = await apiClient.get<Record<string, Signal>>("/signals/latest", { params: { names: signalNames } });
	return response.data;
};

export const getLatestAssetPrice = async (assetNames: string[]): Promise<Record<string, Signal>> => {
	const response = await apiClient.get<Record<string, PriceDTO>>("/assets/latest", { params: { assets: assetNames } });

	// Transform PriceDTO to Signal format
	const transformedData: Record<string, Signal> = {};
	Object.entries(response.data).forEach(([key, priceData]) => {
		transformedData[key] = {
			name: priceData.asset,
			time: priceData.time,
			value: priceData.price, // price becomes value
			source: priceData.source,
		};
	});

	return transformedData;
};
