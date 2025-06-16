import axios from "axios";
import type { OhlcData } from "../types/OhlcData";

const apiClient = axios.create({
	baseURL: "/api/v1",
});

// TODO: Implement /ohlc/${baseName} endpoint in signal-query-api
export const getOhlcData = async (baseName: string): Promise<OhlcData[]> => {
	const response = await apiClient.get<OhlcData[]>(`/signals/ohlc/${baseName}`);
	return response.data;
};
