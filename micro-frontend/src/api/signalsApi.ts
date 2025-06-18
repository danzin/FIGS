import axios from "axios";
import type { OhlcData } from "../types/OhlcData";

const apiClient = axios.create({
	baseURL: "/api/v1",
});

// Note: This takes 1h data
export const getOhlcData = async (baseName: string): Promise<OhlcData[]> => {
	const response = await apiClient.get<OhlcData[]>(`/assets/${baseName}/ohlc/`);
	return response.data;
};
