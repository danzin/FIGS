import React from "react";

export interface OnChainMetricData {
	name: string;
	value: number | string;
	unit?: string;
}

export interface OnChainMetricsByAsset {
	btc: OnChainMetricData[];
	eth: OnChainMetricData[];
	sol: OnChainMetricData[];
}

interface OnChainMetricsProps {
	data: OnChainMetricsByAsset;
	isLoading?: boolean;
}

const formatValue = (value: number | string, unit?: string): string => {
	if (typeof value === "string") return value;

	if (unit === "hash_th") {
		// Hash rate formatting - value is already in TH/s from Blockchain.com API
		// 1 EH/s = 1,000,000 TH/s = 1e6 TH/s
		// 1 PH/s = 1,000 TH/s = 1e3 TH/s
		if (value >= 1e6) return `${(value / 1e6).toFixed(2)} EH/s`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(2)} PH/s`;
		return `${value.toFixed(2)} TH/s`;
	}

	if (unit === "gwei") {
		// Show more decimals for very low gas prices
		if (value < 0.1) return `${value.toFixed(2)} gwei`;
		return `${value.toFixed(1)} gwei`;
	}

	if (unit === "microlamports") {
		// Display micro-lamports nicely
		if (value === 0) return "< 1 μL";
		if (value >= 1000) return `${(value / 1000).toFixed(1)}K μL`;
		return `${value.toFixed(0)} μL`;
	}

	if (unit === "tps") {
		// Transactions per second
		if (value >= 1000) return `${(value / 1000).toFixed(2)}K TPS`;
		return `${value.toFixed(0)} TPS`;
	}

	if (unit === "eth") {
		// ETH amounts (typically staked ETH in millions)
		if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M ETH`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K ETH`;
		return `${value.toFixed(2)} ETH`;
	}

	if (unit === "usd") {
		if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
		if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
		if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
		return `$${value.toLocaleString()}`;
	}

	if (unit === "count") {
		if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
		if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
		return value.toLocaleString();
	}

	if (unit === "percent") {
		return `${value.toFixed(1)}%`;
	}

	if (unit === "bytes") {
		if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GB`;
		if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MB`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(1)} KB`;
		return `${value} B`;
	}

	return typeof value === "number" ? value.toLocaleString() : value;
};

const AssetRow: React.FC<{
	asset: string;
	symbol: string;
	color: string;
	metrics: OnChainMetricData[];
}> = ({ asset, symbol, color, metrics }) => {
	if (metrics.length === 0) return null;

	return (
		<div className="mb-4 last:mb-0">
			<div className="flex items-center gap-2 mb-2">
				<span className={`w-2 h-2 rounded-full ${color}`} />
				<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
					{asset} <span className="text-gray-500 dark:text-gray-400 font-normal">({symbol})</span>
				</span>
			</div>
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
				{metrics.map((metric, index) => (
					<div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 transition-colors duration-300">
						<span className="text-xs text-gray-500 dark:text-gray-400 block mb-1 truncate">{metric.name}</span>
						<span className="text-base font-bold text-gray-900 dark:text-white">
							{formatValue(metric.value, metric.unit)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
};

export const OnChainMetrics: React.FC<OnChainMetricsProps> = ({ data, isLoading = false }) => {
	if (isLoading) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">On-Chain Metrics</h3>
				<div className="space-y-4">
					{Array(3)
						.fill(0)
						.map((_, i) => (
							<div key={i} className="animate-pulse">
								<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
								<div className="grid grid-cols-4 gap-3">
									{Array(4)
										.fill(0)
										.map((_, j) => (
											<div key={j} className="h-14 bg-gray-200 dark:bg-gray-700 rounded" />
										))}
								</div>
							</div>
						))}
				</div>
			</div>
		);
	}

	const hasData = data.btc.length > 0 || data.eth.length > 0 || data.sol.length > 0;

	if (!hasData) {
		return null;
	}

	return (
		<div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white">On-Chain Metrics</h3>
				<span className="text-xs text-gray-500 dark:text-gray-400">Updated hourly</span>
			</div>

			<AssetRow asset="Bitcoin" symbol="BTC" color="bg-orange-500" metrics={data.btc} />
			<AssetRow asset="Ethereum" symbol="ETH" color="bg-blue-500" metrics={data.eth} />
			<AssetRow asset="Solana" symbol="SOL" color="bg-purple-500" metrics={data.sol} />
		</div>
	);
};
