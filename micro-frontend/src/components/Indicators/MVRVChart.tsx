import React, { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries, AreaSeries } from "lightweight-charts";
import type { MVRVData } from "../../types/AdvancedIndicators";
import { Eye, TrendingUp, AlertCircle } from "lucide-react";

interface MVRVChartProps {
	data: MVRVData | null;
	isLoading: boolean;
}

export const MVRVChart: React.FC<MVRVChartProps> = ({ data, isLoading }) => {
	const chartContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!chartContainerRef.current || !data) return;

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
			height: 300,
			rightPriceScale: { borderVisible: false },
			timeScale: { borderVisible: false },
		});

		// Price line
		const priceSeries = chart.addSeries(LineSeries, {
			color: "#3b82f6",
			lineWidth: 2,
			priceScaleId: "price",
		});

		// Z-Score as area
		const zScoreSeries = chart.addSeries(AreaSeries, {
			lineColor: "#10b981",
			topColor: "rgba(16, 185, 129, 0.4)",
			bottomColor: "rgba(239, 68, 68, 0.4)",
			lineWidth: 2,
			priceScaleId: "zscore",
		});

		chart.priceScale("price").applyOptions({
			scaleMargins: { top: 0.1, bottom: 0.4 },
		});

		chart.priceScale("zscore").applyOptions({
			scaleMargins: { top: 0.6, bottom: 0.1 },
		});

		const priceData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.price,
		}));

		const zScoreData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.zScore,
		}));

		priceSeries.setData(priceData);
		zScoreSeries.setData(zScoreData);
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

	const getSignalColor = (signal: string) => {
		switch (signal) {
			case "extreme_undervalued":
				return "text-green-500 bg-green-500/10";
			case "undervalued":
				return "text-emerald-500 bg-emerald-500/10";
			case "fair":
				return "text-yellow-500 bg-yellow-500/10";
			case "overvalued":
				return "text-orange-500 bg-orange-500/10";
			case "extreme_overvalued":
				return "text-red-500 bg-red-500/10";
			default:
				return "text-gray-500 bg-gray-500/10";
		}
	};

	const getSignalLabel = (signal: string) => {
		switch (signal) {
			case "extreme_undervalued":
				return "Extreme Undervalued (Z < 0)";
			case "undervalued":
				return "Undervalued (Z: 0-1)";
			case "fair":
				return "Fair Value (Z: 1-2.5)";
			case "overvalued":
				return "Overvalued (Z: 2.5-3.5)";
			case "extreme_overvalued":
				return "Extreme Overvalued (Z > 3.5)";
			default:
				return "Unknown";
		}
	};

	const getZScorePosition = (zScore: number) => {
		// Map z-score to percentage (clamped between -1 and 4)
		const clamped = Math.max(-1, Math.min(4, zScore));
		return ((clamped + 1) / 5) * 100;
	};

	if (isLoading) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
				<div className="animate-pulse">
					<div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
					<div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
			<div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">MVRV Z-Score</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Market Value to Realized Value indicator</p>
					</div>
					<Eye className="w-6 h-6 text-cyan-500" />
				</div>
			</div>

			<div className="p-6">
				{/* Stats */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<AlertCircle className="w-4 h-4 text-cyan-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Z-Score</span>
						</div>
						<p
							className={`text-2xl font-bold ${
								(data?.mvrvZScore ?? 0) < 0
									? "text-green-500"
									: (data?.mvrvZScore ?? 0) < 2.5
										? "text-yellow-500"
										: "text-red-500"
							}`}
						>
							{data?.mvrvZScore.toFixed(2)}
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<TrendingUp className="w-4 h-4 text-blue-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Current Price</span>
						</div>
						<p className="text-lg font-bold text-gray-900 dark:text-white">${data?.currentPrice.toLocaleString()}</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-xs text-gray-500 dark:text-gray-400">Realized Price*</span>
						</div>
						<p className="text-lg font-bold text-gray-900 dark:text-white">${data?.sma200Week.toLocaleString()}</p>
						<p className="text-xs text-gray-400">*200W SMA Proxy</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-xs text-gray-500 dark:text-gray-400">Signal</span>
						</div>
						<span
							className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSignalColor(
								data?.signal ?? "fair"
							)}`}
						>
							{getSignalLabel(data?.signal ?? "fair")}
						</span>
					</div>
				</div>

				{/* Z-Score Gauge */}
				<div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
					<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Z-Score Gauge</h4>
					<div className="relative h-6 rounded-full overflow-hidden">
						<div className="absolute inset-0 flex">
							<div className="flex-1 bg-green-500"></div>
							<div className="flex-1 bg-emerald-400"></div>
							<div className="flex-1 bg-yellow-400"></div>
							<div className="flex-1 bg-orange-400"></div>
							<div className="flex-1 bg-red-500"></div>
						</div>
						<div
							className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transform -translate-x-1/2"
							style={{ left: `${getZScorePosition(data?.mvrvZScore ?? 0)}%` }}
						>
							<div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded">
								{data?.mvrvZScore.toFixed(2)}
							</div>
						</div>
					</div>
					<div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
						<span>-1 (Buy)</span>
						<span>0</span>
						<span>1</span>
						<span>2.5</span>
						<span>3.5</span>
						<span>4+ (Sell)</span>
					</div>
				</div>

				{/* Chart */}
				<div ref={chartContainerRef} className="w-full" />

				{/* Legend */}
				<div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
					<span className="flex items-center gap-1">
						<div className="w-3 h-0.5 bg-blue-500"></div>
						Price
					</span>
					<span className="flex items-center gap-1">
						<div className="w-3 h-3 rounded bg-gradient-to-b from-green-500 to-red-500"></div>
						Z-Score
					</span>
				</div>
			</div>
		</div>
	);
};
