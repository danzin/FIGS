import axios from "axios";
import { DataSource, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

/**
 * Fetches Ethereum gas prices from Etherscan API
 * Free tier: 5 calls/sec
 *
 */
export class EtherscanGasSource implements DataSource {
	public readonly key = "etherscan_gas";
	private readonly apiKey: string;
	private readonly baseUrl = "https://api.etherscan.io/api";

	constructor(apiKey?: string) {
		// Etherscan works without API key but with rate limits
		this.apiKey = apiKey || "";
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		try {
			const params: Record<string, string> = {
				module: "gastracker",
				action: "gasoracle",
			};

			if (this.apiKey) {
				params.apikey = this.apiKey;
			}

			const response = await axios.get(this.baseUrl, { params });

			if (response.data?.status !== "1" || !response.data?.result) {
				console.warn(`[EtherscanGasSource] Invalid response:`, response.data?.message);
				return null;
			}

			const { SafeGasPrice, ProposeGasPrice, FastGasPrice, suggestBaseFee } = response.data.result;
			const now = new Date();

			const dataPoints: IndicatorDataPoint[] = [
				{
					name: "eth_gas_safe",
					time: now,
					value: parseFloat(SafeGasPrice),
					source: "Etherscan",
				},
				{
					name: "eth_gas_standard",
					time: now,
					value: parseFloat(ProposeGasPrice),
					source: "Etherscan",
				},
				{
					name: "eth_gas_fast",
					time: now,
					value: parseFloat(FastGasPrice),
					source: "Etherscan",
				},
			];

			// Add base fee if available (EIP-1559)
			if (suggestBaseFee) {
				dataPoints.push({
					name: "eth_gas_base_fee",
					time: now,
					value: parseFloat(suggestBaseFee),
					source: "Etherscan",
				});
			}

			console.log(
				`[EtherscanGasSource] Fetched gas prices - Safe: ${SafeGasPrice}, Standard: ${ProposeGasPrice}, Fast: ${FastGasPrice} gwei`
			);

			return dataPoints;
		} catch (error) {
			console.error(`[EtherscanGasSource] Error fetching gas prices:`, error);
			if (axios.isAxiosError(error)) {
				if (error.response?.status === 429) {
					throw new Error("Etherscan rate limit exceeded");
				}
			}
			throw error;
		}
	}
}

/**
 * Multi-chain gas tracker using Owlracle API
 */
export class OwlracleGasSource implements DataSource {
	public readonly key: string;
	private readonly chain: string;
	private readonly apiKey: string;
	private readonly baseUrl = "https://api.owlracle.info/v4";

	// Chain IDs for Owlracle
	private static readonly CHAINS: Record<string, string> = {
		ethereum: "eth",
		bsc: "bsc",
		polygon: "poly",
		avalanche: "avax",
		fantom: "ftm",
		cronos: "cro",
	};

	constructor(chain: string, apiKey?: string) {
		this.chain = OwlracleGasSource.CHAINS[chain] || chain;
		this.key = `owlracle_gas_${chain}`;
		this.apiKey = apiKey || "";
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		try {
			const url = `${this.baseUrl}/${this.chain}/gas`;
			const params: Record<string, string> = {
				accept: "90,60,35", // percentiles for fast/standard/slow
			};

			if (this.apiKey) {
				params.apikey = this.apiKey;
			}

			const response = await axios.get(url, { params });

			if (!response.data?.speeds) {
				console.warn(`[OwlracleGasSource] Invalid response for ${this.chain}`);
				return null;
			}

			const now = new Date();
			const { speeds } = response.data;

			const dataPoints: IndicatorDataPoint[] = speeds.map((speed: { acceptance: number; gasPrice: number }) => ({
				name: `${this.chain}_gas_${speed.acceptance}pct`,
				time: now,
				value: speed.gasPrice,
				source: "Owlracle",
			}));

			console.log(
				`[OwlracleGasSource] Fetched ${this.chain} gas prices:`,
				speeds.map((s: { gasPrice: number }) => s.gasPrice).join(", ")
			);

			return dataPoints;
		} catch (error) {
			console.error(`[OwlracleGasSource] Error fetching ${this.chain} gas:`, error);
			throw error;
		}
	}
}
