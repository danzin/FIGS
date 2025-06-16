import axios from "axios";
import type { OhlcData } from "../types/OhlcData";

const apiClient = axios.create({
	baseURL: "/api/v1",
});

// TODO: Implement /ohlc/${baseName} endpoint in signal-query-api
export const getOhlcData = async (baseName: string, interval: string = "1 hour"): Promise<OhlcData[]> => {
	const response = await apiClient.get<OhlcData[]>(`/ohlc/${baseName}`, {
		params: { interval },
	});
	return response.data;
};
