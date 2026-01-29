import React, { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries, HistogramSeries } from "lightweight-charts";
import type { StablecoinLiquidityData } from "../../types/AdvancedIndicators";
import { DollarSign, TrendingUp, TrendingDown, Droplets } from "lucide-react";

interface StablecoinLiquidityChartProps {
	data: StablecoinLiquidityData | null;
	isLoading: boolean;
}

export const StablecoinLiquidityChart: React.FC<StablecoinLiquidityChartProps> = ({ data, isLoading }) => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const flowChartRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!chartContainerRef.current || !data) return;

		// Main chart - Total Market Cap
		const chart = createChart(chartContainerRef.current, {
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: "#9ca3af",
			},
			grid: {
				vertLines: { color: "rgba(107, 114, 128, 0.1)" },
				horzLines: { color: "rgba(107, 114, 128, 0.1)" },
			},
			width: chartContainerRef.current.clientWidth,
			height: 200,
			rightPriceScale: { borderVisible: false },
			timeScale: { borderVisible: false },
		});

		const areaSeries = chart.addSeries(AreaSeries, {
			lineColor: "#8b5cf6",
			topColor: "rgba(139, 92, 246, 0.4)",
			bottomColor: "rgba(139, 92, 246, 0.0)",
			lineWidth: 2,
		});

		const marketCapData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.totalMarketCap / 1e9,
		}));

		areaSeries.setData(marketCapData);
		chart.timeScale().fitContent();

		const handleResize = () => {
			if (chartContainerRef.current) {
				chart.applyOptions({ width: chartContainerRef.current.clientWidth });
			}
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			chart.remove();
		};
	}, [data]);

	// Flow Index Chart
	useEffect(() => {
		if (!flowChartRef.current || !data) return;

		const chart = createChart(flowChartRef.current, {
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: "#9ca3af",
			},
			grid: {
				vertLines: { color: "rgba(107, 114, 128, 0.1)" },
				horzLines: { color: "rgba(107, 114, 128, 0.1)" },
			},
			width: flowChartRef.current.clientWidth,
			height: 150,
			rightPriceScale: { borderVisible: false },
			timeScale: { borderVisible: false },
		});

		const histogramSeries = chart.addSeries(HistogramSeries, {
			color: "#10b981",
		});

		const flowData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.liquidityFlow,
			color: d.liquidityFlow >= 0 ? "#10b981" : "#ef4444",
		}));

		histogramSeries.setData(flowData);
		chart.timeScale().fitContent();

		const handleResize = () => {
			if (flowChartRef.current) {
				chart.applyOptions({ width: flowChartRef.current.clientWidth });
			}
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			chart.remove();
		};
	}, [data]);

	const formatMarketCap = (value: number) => {
		if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
		if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
		return `$${(value / 1e6).toFixed(1)}M`;
	};

	if (isLoading) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
				<div className="animate-pulse">
					<div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
					<div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
			<div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stablecoin Liquidity</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Macro cycle fuel indicator</p>
					</div>
					<Droplets className="w-6 h-6 text-purple-500" />
				</div>
			</div>

			<div className="p-6">
				{/* Stats Grid */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<DollarSign className="w-4 h-4 text-purple-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Total Supply</span>
						</div>
						<p className="text-lg font-bold text-gray-900 dark:text-white">
							{formatMarketCap(data?.totalMarketCap ?? 0)}
						</p>
						<p className={`text-xs ${(data?.marketCapChange24h ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
							{(data?.marketCapChange24h ?? 0) >= 0 ? "+" : ""}
							{data?.marketCapChange24h.toFixed(2)}% 24h
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<TrendingUp className="w-4 h-4 text-green-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">YoY Growth</span>
						</div>
						<p className={`text-lg font-bold ${(data?.yoyGrowth ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
							{(data?.yoyGrowth ?? 0) >= 0 ? "+" : ""}
							{data?.yoyGrowth.toFixed(1)}%
						</p>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							{(data?.yoyGrowth ?? 0) > 0 ? "Bull Regime" : "Bear Regime"}
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							{(data?.liquidityFlowIndex ?? 0) >= 0 ? (
								<TrendingUp className="w-4 h-4 text-green-500" />
							) : (
								<TrendingDown className="w-4 h-4 text-red-500" />
							)}
							<span className="text-xs text-gray-500 dark:text-gray-400">Flow Index</span>
						</div>
						<p
							className={`text-lg font-bold ${
								(data?.liquidityFlowIndex ?? 0) >= 0 ? "text-green-500" : "text-red-500"
							}`}
						>
							{(data?.liquidityFlowIndex ?? 0) >= 0 ? "+" : ""}
							{data?.liquidityFlowIndex.toFixed(2)}
						</p>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							{(data?.liquidityFlowIndex ?? 0) > 0 ? "Accelerating" : "Decelerating"}
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-xs text-gray-500 dark:text-gray-400">Signal</span>
						</div>
						<p
							className={`text-lg font-bold ${
								(data?.liquidityFlowIndex ?? 0) > 3
									? "text-green-500"
									: (data?.liquidityFlowIndex ?? 0) > 0
										? "text-yellow-500"
										: "text-red-500"
							}`}
						>
							{(data?.liquidityFlowIndex ?? 0) > 3
								? "Strong Buy"
								: (data?.liquidityFlowIndex ?? 0) > 0
									? "Accumulate"
									: "Caution"}
						</p>
					</div>
				</div>

				{/* Stablecoin Breakdown */}
				<div className="mb-6">
					<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Breakdown by Stablecoin</h4>
					<div className="space-y-2">
						{data?.breakdown.map((coin) => (
							<div
								key={coin.symbol}
								className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
							>
								<div className="flex items-center gap-2">
									<span className="font-medium text-gray-900 dark:text-white">{coin.symbol}</span>
									<span className="text-xs text-gray-500 dark:text-gray-400">{coin.name}</span>
								</div>
								<div className="text-right">
									<span className="font-medium text-gray-900 dark:text-white">{formatMarketCap(coin.marketCap)}</span>
									<span className={`ml-2 text-xs ${coin.change24h >= 0 ? "text-green-500" : "text-red-500"}`}>
										{coin.change24h >= 0 ? "+" : ""}
										{coin.change24h.toFixed(2)}%
									</span>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Charts */}
				<div className="space-y-4">
					<div>
						<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Total Stablecoin Market Cap (Billions)
						</h4>
						<div ref={chartContainerRef} className="w-full" />
					</div>

					<div>
						<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Liquidity Flow Index</h4>
						<div ref={flowChartRef} className="w-full" />
					</div>
				</div>
			</div>
		</div>
	);
};
