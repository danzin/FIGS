import axios from "axios";
import type { OhlcData } from "../types/OhlcData";
import type { Interval } from "../types/Interval";

const apiClient = axios.create({
	baseURL: "/api/v1",
});
// Note: This takes 1h data
export const getOhlcData = async (baseName: string, interval: Interval): Promise<OhlcData[]> => {
	const response = await apiClient.get<OhlcData[]>(`/assets/${baseName}/ohlc/`, {
		params: { interval },
	});
	return response.data;
};
