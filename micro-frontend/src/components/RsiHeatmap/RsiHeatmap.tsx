import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

export interface RsiData {
	symbol: string;
	name: string;
	rsi: number;
	price: number;
	priceChange24h: number;
}

interface RsiHeatmapProps {
	data: RsiData[];
	isLoading?: boolean;
}

const getRsiStatus = (rsi: number): { label: string; color: string; bgColor: string; action: string } => {
	if (rsi <= 30) {
		return {
			label: "Oversold",
			color: "text-green-600 dark:text-green-400",
			bgColor: "bg-green-100 dark:bg-green-900/30",
			action: "Potential Buy",
		};
	}
	if (rsi >= 70) {
		return {
			label: "Overbought",
			color: "text-red-600 dark:text-red-400",
			bgColor: "bg-red-100 dark:bg-red-900/30",
			action: "Potential Sell",
		};
	}
	return {
		label: "Neutral",
		color: "text-gray-600 dark:text-gray-400",
		bgColor: "bg-gray-100 dark:bg-gray-800",
		action: "Hold",
	};
};

const getRsiBarColor = (rsi: number): string => {
	if (rsi <= 30) return "bg-gradient-to-r from-green-500 to-green-400";
	if (rsi >= 70) return "bg-gradient-to-r from-red-400 to-red-500";
	if (rsi < 50) return "bg-gradient-to-r from-yellow-500 to-yellow-400";
	return "bg-gradient-to-r from-yellow-400 to-orange-400";
};

export const RsiHeatmap: React.FC<RsiHeatmapProps> = ({ data, isLoading = false }) => {
	useTheme(); // Theme context for potential future use

	// Sort by RSI - oversold first (buy opportunities)
	const sortedData = [...data].sort((a, b) => a.rsi - b.rsi);

	if (isLoading) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
				<div className="animate-pulse">
					<div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
					{Array(5)
						.fill(0)
						.map((_, i) => (
							<div key={i} className="flex items-center gap-3 py-2">
								<div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
								<div className="flex-1">
									<div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
									<div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded" />
								</div>
							</div>
						))}
				</div>
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">RSI Heatmap</h3>
				<p className="text-sm text-gray-500 dark:text-gray-400">No RSI data available</p>
			</div>
		);
	}

	// Group by status
	const oversold = sortedData.filter((d) => d.rsi <= 30);
	const overbought = sortedData.filter((d) => d.rsi >= 70);
	const neutral = sortedData.filter((d) => d.rsi > 30 && d.rsi < 70);

	return (
		<div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">RSI Heatmap</h3>
					<p className="text-xs text-gray-500 dark:text-gray-400">14-period RSI • Sorted by opportunity</p>
				</div>
				<div className="flex items-center gap-3 text-xs">
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 rounded-full bg-green-500" />
						<span className="text-gray-600 dark:text-gray-300">≤30 Buy</span>
					</div>
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 rounded-full bg-red-500" />
						<span className="text-gray-600 dark:text-gray-300">≥70 Sell</span>
					</div>
				</div>
			</div>

			{/* Quick Summary */}
			<div className="grid grid-cols-3 gap-2 mb-4">
				<div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
					<span className="text-lg font-bold text-green-600 dark:text-green-400">{oversold.length}</span>
					<p className="text-[10px] text-green-600 dark:text-green-400 font-medium">OVERSOLD</p>
				</div>
				<div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
					<span className="text-lg font-bold text-gray-600 dark:text-gray-300">{neutral.length}</span>
					<p className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">NEUTRAL</p>
				</div>
				<div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
					<span className="text-lg font-bold text-red-600 dark:text-red-400">{overbought.length}</span>
					<p className="text-[10px] text-red-600 dark:text-red-400 font-medium">OVERBOUGHT</p>
				</div>
			</div>

			{/* RSI List */}
			<div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
				{sortedData.map((item) => {
					const status = getRsiStatus(item.rsi);
					const barColor = getRsiBarColor(item.rsi);

					return (
						<div
							key={item.symbol}
							className={`rounded-lg p-3 transition-all duration-200 hover:scale-[1.01] ${status.bgColor}`}
						>
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
										<span className="text-xs font-bold text-gray-700 dark:text-gray-200">
											{item.symbol.slice(0, 3).toUpperCase()}
										</span>
									</div>
									<div>
										<p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
										<div className="flex items-center gap-1">
											<span className="text-xs text-gray-500 dark:text-gray-400">
												${item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
											</span>
											<span
												className={`text-xs flex items-center ${
													item.priceChange24h >= 0 ? "text-green-500" : "text-red-500"
												}`}
											>
												{item.priceChange24h >= 0 ? (
													<TrendingUp className="w-3 h-3" />
												) : (
													<TrendingDown className="w-3 h-3" />
												)}
												{Math.abs(item.priceChange24h).toFixed(2)}%
											</span>
										</div>
									</div>
								</div>
								<div className="text-right">
									<p className={`text-lg font-bold ${status.color}`}>{item.rsi.toFixed(1)}</p>
									<p className={`text-[10px] font-medium ${status.color}`}>{status.action}</p>
								</div>
							</div>

							{/* RSI Bar */}
							<div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
								<div
									className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor}`}
									style={{ width: `${item.rsi}%` }}
								/>
								{/* Threshold markers */}
								<div className="absolute left-[30%] top-0 h-full w-px bg-green-600 opacity-50" />
								<div className="absolute left-[70%] top-0 h-full w-px bg-red-600 opacity-50" />
							</div>
						</div>
					);
				})}
			</div>

			{/* Legend */}
			<div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
				<div className="flex items-center justify-center gap-1">
					<span className="text-[10px] text-green-500 font-medium">0</span>
					<div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />
					<span className="text-[10px] text-red-500 font-medium">100</span>
				</div>
			</div>
		</div>
	);
};
