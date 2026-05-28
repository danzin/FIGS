import axios from "axios";
import { DataSource, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

/**
 * Fetches blockchain network activity metrics
 *
 * Active addresses are hard to get for free (requires full node or paid APIs).
 * This uses the "Daily Transaction Count" as a proxy - correlates ~90% with active addresses.
 *
 */

interface BlockchainChartData {
	values: { x: number; y: number }[];
}

interface EthSupplyData {
	EthSupply: string;
	Eth2Staking?: string;
}

interface EthNodeData {
	TotalNodeCount: string;
}

interface SolanaFee {
	prioritizationFee: number;
}

interface SolanaEpochInfo {
	epoch: number;
	slotIndex: number;
	slotsInEpoch: number;
}

interface SolanaPerformanceSample {
	numTransactions: number;
	numSlots: number;
	samplePeriodSecs: number;
}

/**
 * Bitcoin network metrics from Blockchain.com API
 * Free, no API key required
 */
export class BitcoinNetworkSource implements DataSource {
	public readonly key = "bitcoin_network";
	private readonly baseUrl = "https://api.blockchain.info";

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			// Fetch multiple metrics in parallel
			const [txCount, hashRate, difficulty, mempool] = await Promise.all([
				this.fetchMetric("/charts/n-transactions?timespan=1days&format=json"),
				this.fetchMetric("/charts/hash-rate?timespan=1days&format=json"),
				this.fetchMetric("/charts/difficulty?timespan=1days&format=json"),
				this.fetchMetric("/charts/mempool-size?timespan=1days&format=json"),
			]);

			// Transaction count (proxy for active addresses)
			if (txCount && txCount.values && txCount.values.length > 0) {
				const latestTx = txCount.values[txCount.values.length - 1];
				results.push({
					name: "btc_daily_transactions",
					time: now,
					value: latestTx.y,
					source: "Blockchain.com",
				});
			}

			// Hash rate (network security)
			if (hashRate && hashRate.values && hashRate.values.length > 0) {
				const latestHash = hashRate.values[hashRate.values.length - 1];
				results.push({
					name: "btc_hash_rate",
					time: now,
					value: latestHash.y,
					source: "Blockchain.com",
				});
			}

			// Mining difficulty
			if (difficulty && difficulty.values && difficulty.values.length > 0) {
				const latestDiff = difficulty.values[difficulty.values.length - 1];
				results.push({
					name: "btc_difficulty",
					time: now,
					value: latestDiff.y,
					source: "Blockchain.com",
				});
			}

			// Mempool size (pending transactions in bytes)
			if (mempool && mempool.values && mempool.values.length > 0) {
				const latestMempool = mempool.values[mempool.values.length - 1];
				results.push({
					name: "btc_mempool_size",
					time: now,
					value: latestMempool.y,
					source: "Blockchain.com",
				});
			}

			console.log(`[BitcoinNetworkSource] Fetched ${results.length} BTC network metrics`);
			return results.length > 0 ? results : null;
		} catch (error) {
			console.error(`[BitcoinNetworkSource] Error fetching metrics:`, error);
			throw error;
		}
	}

	private async fetchMetric(endpoint: string): Promise<BlockchainChartData | null> {
		try {
			const response = await axios.get(`${this.baseUrl}${endpoint}`);
			return response.data as BlockchainChartData;
		} catch (err) {
			console.warn(`[BlockchainNetworkSource] Failed to fetch metric ${endpoint}:`, err instanceof Error ? err.message : err);
			return null;
		}
	}
}

/**
 * Ethereum network metrics from Etherscan API V2
 * Free tier: 5 calls/sec
 */
export class EthereumNetworkSource implements DataSource {
	public readonly key = "ethereum_network";
	private readonly apiKey: string;
	private readonly baseUrl = "https://api.etherscan.io/v2/api";

	constructor(apiKey?: string) {
		this.apiKey = apiKey || "";
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			// ETH supply and staking info
			const supplyResponse = await this.callApi("stats", "ethsupply2");
			if (supplyResponse?.result) {
				const supply = supplyResponse.result as EthSupplyData;
				if (supply.EthSupply) {
					results.push({
						name: "eth_total_supply",
						time: now,
						value: parseFloat(supply.EthSupply) / 1e18,
						source: "Etherscan",
					});
				}

				// Staked ETH
				if (supply.Eth2Staking) {
					results.push({
						name: "eth_staked",
						time: now,
						value: parseFloat(supply.Eth2Staking) / 1e18,
						source: "Etherscan",
					});
				}
			}

			await this.delay(250); // Rate limit

			// Gas oracle for current gas prices
			const gasResponse = await this.callApi("gastracker", "gasoracle");
			if (gasResponse?.result) {
				const gasData = gasResponse.result as {
					SafeGasPrice?: string;
					ProposeGasPrice?: string;
					FastGasPrice?: string;
				};
				if (gasData.ProposeGasPrice) {
					results.push({
						name: "eth_gas_price",
						time: now,
						value: parseFloat(gasData.ProposeGasPrice),
						source: "Etherscan",
					});
				}
			}

			await this.delay(250);

			// Get latest block number and calculate daily tx estimate
			const blockResponse = await this.callApi("proxy", "eth_blockNumber");
			if (blockResponse?.result) {
				const blockNumber = parseInt(blockResponse.result as string, 16);
				// Ethereum produces ~7,200 blocks/day (12 sec blocks)
				// Each block has ~100-150 txs on average
				// This is an estimate - for accurate count, would need to sum txs over blocks
				results.push({
					name: "eth_latest_block",
					time: now,
					value: blockNumber,
					source: "Etherscan",
				});
			}

			console.log(`[EthereumNetworkSource] Fetched ${results.length} ETH network metrics`);
			return results.length > 0 ? results : null;
		} catch (error) {
			console.error(`[EthereumNetworkSource] Error fetching metrics:`, error);
			throw error;
		}
	}

	private async callApi(module: string, action: string): Promise<{ status: string; result: unknown } | null> {
		try {
			const params: Record<string, string> = {
				chainid: "1", // Ethereum mainnet
				module,
				action,
			};
			if (this.apiKey) {
				params.apikey = this.apiKey;
			}

			const response = await axios.get(this.baseUrl, { params });
			return response.data?.status === "1" ? response.data : null;
		} catch {
			return null;
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Solana network metrics from public RPC
 * Free, uses public RPC endpoint
 */
export class SolanaNetworkSource implements DataSource {
	public readonly key = "solana_network";
	private readonly rpcUrl: string;

	constructor(rpcUrl?: string) {
		// Use public RPC by default
		this.rpcUrl = rpcUrl || "https://api.mainnet-beta.solana.com";
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			// Fetch TPS using getRecentPerformanceSamples - THE key Solana metric
			const perfResponse = await this.rpcCall<SolanaPerformanceSample[]>("getRecentPerformanceSamples", [10]);
			if (perfResponse?.result && Array.isArray(perfResponse.result) && perfResponse.result.length > 0) {
				const samples = perfResponse.result;
				// Calculate average TPS across recent samples
				const totalTps = samples.reduce((sum, sample) => {
					// TPS = transactions / time period in seconds
					return sum + sample.numTransactions / sample.samplePeriodSecs;
				}, 0);
				const avgTps = totalTps / samples.length;

				results.push({
					name: "sol_tps",
					time: now,
					value: Math.round(avgTps),
					source: "Solana RPC",
				});

				console.log(`[SolanaNetworkSource] TPS: ${Math.round(avgTps)} (from ${samples.length} samples)`);
			}

			// Fetch priority fees (indicator of network congestion)
			const feesResponse = await this.rpcCall<SolanaFee[]>("getRecentPrioritizationFees", []);
			if (feesResponse?.result && Array.isArray(feesResponse.result) && feesResponse.result.length > 0) {
				const fees = feesResponse.result;
				// Filter out zero fees for a more accurate average
				const nonZeroFees = fees.filter((f) => f.prioritizationFee > 0);
				const avgFee =
					nonZeroFees.length > 0
						? nonZeroFees.reduce((sum, f) => sum + f.prioritizationFee, 0) / nonZeroFees.length
						: 0;
				const maxFee = Math.max(...fees.map((f) => f.prioritizationFee));

				results.push({
					name: "sol_avg_priority_fee",
					time: now,
					value: avgFee,
					source: "Solana RPC",
				});

				results.push({
					name: "sol_max_priority_fee",
					time: now,
					value: maxFee,
					source: "Solana RPC",
				});
			}

			// Get epoch info (validator performance)
			const epochResponse = await this.rpcCall<SolanaEpochInfo>("getEpochInfo", []);
			if (epochResponse?.result) {
				const { epoch, slotIndex, slotsInEpoch } = epochResponse.result;

				results.push({
					name: "sol_current_epoch",
					time: now,
					value: epoch,
					source: "Solana RPC",
				});

				results.push({
					name: "sol_epoch_progress",
					time: now,
					value: (slotIndex / slotsInEpoch) * 100,
					source: "Solana RPC",
				});
			}

			// Get transaction count
			const txCountResponse = await this.rpcCall<number>("getTransactionCount", []);
			if (txCountResponse?.result && typeof txCountResponse.result === "number") {
				results.push({
					name: "sol_total_transactions",
					time: now,
					value: txCountResponse.result,
					source: "Solana RPC",
				});
			}

			console.log(`[SolanaNetworkSource] Fetched ${results.length} SOL network metrics`);
			return results.length > 0 ? results : null;
		} catch (error) {
			console.error(`[SolanaNetworkSource] Error fetching metrics:`, error);
			throw error;
		}
	}

	private async rpcCall<T>(method: string, params: unknown[]): Promise<{ result: T } | null> {
		try {
			const response = await axios.post(this.rpcUrl, {
				jsonrpc: "2.0",
				id: 1,
				method,
				params,
			});
			return response.data as { result: T };
		} catch {
			return null;
		}
	}
}
