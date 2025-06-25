import axios from "axios";
import type { OhlcData, Signal, Interval } from "../types/OhlcData";

const apiClient = axios.create({
	baseURL: "/api/v1",
});

export const getOhlcData = async (baseName: string, interval: Interval): Promise<OhlcData[]> => {
	const response = await apiClient.get<OhlcData[]>(`/assets/${baseName}/ohlc/`, {
		params: { interval },
	});
	return response.data;
};

//eg, request 'api/v1/signals/latest/?names=fear_greed_index,FRED_M2SL'
export const getLatestMacroSignals = async (signalNames: string[]): Promise<Record<string, Signal>> => {
	const response = await apiClient.get<Record<string, Signal>>("/signals/latest", {
		params: {
			names: signalNames.join(","),
		},
	});
	return response.data;
};
