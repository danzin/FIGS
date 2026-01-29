import axios from "axios";
import { DataSource, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

/**
 * Fetches extended Bitcoin hash rate data from Blockchain.com
 * for Hash Ribbon indicator calculation
 */

interface BlockchainChartResponse {
	values: { x: number; y: number }[];
}

export class HashRateExtendedSource implements DataSource {
	public readonly key = "hash_rate_extended";
	private readonly baseUrl = "https://api.blockchain.info";

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const results: IndicatorDataPoint[] = [];

		try {
			// Fetch 90 days of hash rate data for SMA calculations
			const response = await axios.get<BlockchainChartResponse>(`${this.baseUrl}/charts/hash-rate`, {
				params: {
					timespan: "90days",
					format: "json",
				},
				timeout: 30000,
			});

			const values = response.data?.values;
			if (!values || values.length === 0) {
				console.warn("[HashRateExtendedSource] No hash rate data received");
				return null;
			}

			const latestPoint = values[values.length - 1];
			const latestTime = new Date(latestPoint.x * 1000);

			// Get the latest hash rate
			const latestHashRate = latestPoint.y;
			results.push({
				name: "btc_hash_rate",
				time: latestTime,
				value: latestHashRate,
				source: "Blockchain.com",
			});

			// Calculate 30-day SMA
			const last30Days = values.slice(-30);
			if (last30Days.length >= 30) {
				const sma30 = last30Days.reduce((sum, v) => sum + v.y, 0) / 30;
				results.push({
					name: "btc_hash_rate_sma30",
					time: latestTime,
					value: sma30,
					source: "Blockchain.com",
				});
			}

			// Calculate 60-day SMA
			const last60Days = values.slice(-60);
			if (last60Days.length >= 60) {
				const sma60 = last60Days.reduce((sum, v) => sum + v.y, 0) / 60;
				results.push({
					name: "btc_hash_rate_sma60",
					time: latestTime,
					value: sma60,
					source: "Blockchain.com",
				});
			}

			// Determine ribbon status (miner capitulation signal)
			if (results.length >= 3) {
				const sma30 = results.find((r) => r.name === "btc_hash_rate_sma30")?.value || 0;
				const sma60 = results.find((r) => r.name === "btc_hash_rate_sma60")?.value || 0;

				// Ribbon status: 1 = recovery (30 > 60), 0 = neutral, -1 = capitulation (30 < 60)
				let ribbonStatus = 0;
				if (sma30 > sma60 * 1.02)
					ribbonStatus = 1; // Recovery (with 2% buffer)
				else if (sma30 < sma60 * 0.98) ribbonStatus = -1; // Capitulation

				results.push({
					name: "btc_miner_ribbon_status",
					time: latestTime,
					value: ribbonStatus,
					source: "Blockchain.com",
				});

				// Calculate 30d change
				if (values.length >= 31) {
					const thirtyDaysAgoHash = values[values.length - 31].y;
					const change30d = ((latestHashRate - thirtyDaysAgoHash) / thirtyDaysAgoHash) * 100;
					results.push({
						name: "btc_hash_rate_change_30d",
						time: latestTime,
						value: change30d,
						source: "Blockchain.com",
					});
				}
			}

			console.log(`[HashRateExtendedSource] Fetched ${results.length} hash rate metrics`);
			return results;
		} catch (error) {
			console.error("[HashRateExtendedSource] Error:", error);
			throw error;
		}
	}
}

/**
 * Fetches Bitcoin mining difficulty for power law and miner health calculations
 */
export class MiningDifficultySource implements DataSource {
	public readonly key = "mining_difficulty";
	private readonly baseUrl = "https://api.blockchain.info";

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const results: IndicatorDataPoint[] = [];

		try {
			const response = await axios.get<BlockchainChartResponse>(`${this.baseUrl}/charts/difficulty`, {
				params: {
					timespan: "60days",
					format: "json",
				},
				timeout: 30000,
			});

			const values = response.data?.values;
			if (!values || values.length === 0) return null;

			const latestDifficulty = values[values.length - 1].y;
			results.push({
				name: "btc_difficulty",
				time: now,
				value: latestDifficulty,
				source: "Blockchain.com",
			});

			// Calculate difficulty change since last adjustment (~2 weeks)
			if (values.length >= 14) {
				const twoWeeksAgo = values[values.length - 14].y;
				const difficultyChange = ((latestDifficulty - twoWeeksAgo) / twoWeeksAgo) * 100;
				results.push({
					name: "btc_difficulty_change_14d",
					time: now,
					value: difficultyChange,
					source: "Blockchain.com",
				});
			}

			return results;
		} catch (error) {
			console.error("[MiningDifficultySource] Error:", error);
			throw error;
		}
	}
}
