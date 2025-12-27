import axios from "axios";
import type {
	PowerLawData,
	StablecoinLiquidityData,
	OpenInterestData,
	MomentumCoalescenceData,
	MVRVData,
	HashRateData,
	CompositeIndicatorData,
	CVDData,
} from "../types/AdvancedIndicators";

const apiClient = axios.create({
	baseURL: "/api",
});

export const getPowerLawData = async (): Promise<PowerLawData> => {
	const response = await apiClient.get<PowerLawData>("/indicators/power-law");
	return response.data;
};

export const getStablecoinLiquidity = async (): Promise<StablecoinLiquidityData> => {
	const response = await apiClient.get<StablecoinLiquidityData>("/indicators/stablecoin-liquidity");
	return response.data;
};

export const getOpenInterest = async (): Promise<OpenInterestData> => {
	const response = await apiClient.get<OpenInterestData>("/indicators/open-interest");
	return response.data;
};

export const getMomentumCoalescence = async (): Promise<MomentumCoalescenceData> => {
	const response = await apiClient.get<MomentumCoalescenceData>("/indicators/momentum-coalescence");
	return response.data;
};

export const getMVRVData = async (): Promise<MVRVData> => {
	const response = await apiClient.get<MVRVData>("/indicators/mvrv");
	return response.data;
};

export const getHashRateData = async (): Promise<HashRateData> => {
	const response = await apiClient.get<HashRateData>("/indicators/hash-rate");
	return response.data;
};

export const getCompositeIndicator = async (): Promise<CompositeIndicatorData> => {
	const response = await apiClient.get<CompositeIndicatorData>("/indicators/composite");
	return response.data;
};

export const getCVDData = async (): Promise<CVDData> => {
	const response = await apiClient.get<CVDData>("/indicators/cvd");
	return response.data;
};
