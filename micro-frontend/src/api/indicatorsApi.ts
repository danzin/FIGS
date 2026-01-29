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
	baseURL: "/api/indicators",
});

export const getPowerLawData = async (): Promise<PowerLawData> => {
	const response = await apiClient.get<PowerLawData>("/power-law");
	return response.data;
};

export const getStablecoinLiquidity = async (): Promise<StablecoinLiquidityData> => {
	const response = await apiClient.get<StablecoinLiquidityData>("/stablecoin-liquidity");
	return response.data;
};

export const getOpenInterest = async (): Promise<OpenInterestData> => {
	const response = await apiClient.get<OpenInterestData>("/open-interest");
	return response.data;
};

export const getMomentumCoalescence = async (): Promise<MomentumCoalescenceData> => {
	const response = await apiClient.get<MomentumCoalescenceData>("/momentum-coalescence");
	return response.data;
};

export const getMVRVData = async (): Promise<MVRVData> => {
	const response = await apiClient.get<MVRVData>("/mvrv");
	return response.data;
};

export const getHashRateData = async (): Promise<HashRateData> => {
	const response = await apiClient.get<HashRateData>("/hash-rate");
	return response.data;
};

export const getCompositeIndicator = async (): Promise<CompositeIndicatorData> => {
	const response = await apiClient.get<CompositeIndicatorData>("/composite");
	return response.data;
};

export const getCVDData = async (): Promise<CVDData> => {
	const response = await apiClient.get<CVDData>("/cvd");
	return response.data;
};
