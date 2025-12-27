import React, { useEffect, useRef } from "react";
import { createChart, ColorType, LineStyle, LineSeries } from "lightweight-charts";
import type { HashRateData } from "../../types/AdvancedIndicators";
import { Cpu, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface HashRateChartProps {
	data: HashRateData | null;
	isLoading: boolean;
}

export const HashRateChart: React.FC<HashRateChartProps> = ({ data, isLoading }) => {
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
			height: 250,
			rightPriceScale: { borderVisible: false },
			timeScale: { borderVisible: false },
		});

		// Hash rate line
		const hashRateSeries = chart.addSeries(LineSeries, {
			color: "#3b82f6",
			lineWidth: 2,
		});

		// 30-day SMA (short ribbon)
		const sma30Series = chart.addSeries(LineSeries, {
			color: "#10b981",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
		});

		// 60-day SMA (long ribbon)
		const sma60Series = chart.addSeries(LineSeries, {
			color: "#ef4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
		});

		const hashRateData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.hashRate / 1e6, // Convert to EH/s
		}));

		const sma30Data = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.sma30 / 1e6,
		}));

		const sma60Data = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.sma60 / 1e6,
		}));

		hashRateSeries.setData(hashRateData);
		sma30Series.setData(sma30Data);
		sma60Series.setData(sma60Data);
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

	const formatHashRate = (value: number) => {
		if (value >= 1e9) return `${(value / 1e9).toFixed(0)} EH/s`;
		if (value >= 1e6) return `${(value / 1e6).toFixed(0)} PH/s`;
		return `${(value / 1e3).toFixed(0)} TH/s`;
	};

	const getRibbonStatusColor = (status: string) => {
		switch (status) {
			case "recovery":
				return "text-green-500 bg-green-500/10";
			case "capitulation":
				return "text-red-500 bg-red-500/10";
			default:
				return "text-yellow-500 bg-yellow-500/10";
		}
	};

	const getRibbonStatusLabel = (status: string) => {
		switch (status) {
			case "recovery":
				return "Miner Recovery (Bullish)";
			case "capitulation":
				return "Miner Capitulation (Buy Signal)";
			default:
				return "Neutral";
		}
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
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hash Rate & Miner Ribbon</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
							Network security & miner capitulation indicator
						</p>
					</div>
					<Cpu className="w-6 h-6 text-blue-500" />
				</div>
			</div>

			<div className="p-6">
				{/* Stats */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<Cpu className="w-4 h-4 text-blue-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Current Hash Rate</span>
						</div>
						<p className="text-lg font-bold text-gray-900 dark:text-white">
							{formatHashRate(data?.currentHashRate ?? 0)}
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							{(data?.hashRateChange30d ?? 0) >= 0 ? (
								<TrendingUp className="w-4 h-4 text-green-500" />
							) : (
								<TrendingDown className="w-4 h-4 text-red-500" />
							)}
							<span className="text-xs text-gray-500 dark:text-gray-400">30D Change</span>
						</div>
						<p
							className={`text-lg font-bold ${(data?.hashRateChange30d ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}
						>
							{(data?.hashRateChange30d ?? 0) >= 0 ? "+" : ""}
							{data?.hashRateChange30d.toFixed(1)}%
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<AlertTriangle className="w-4 h-4 text-amber-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Capitulation</span>
						</div>
						<p className={`text-lg font-bold ${data?.minerCapitulation ? "text-green-500" : "text-gray-500"}`}>
							{data?.minerCapitulation ? "Active (Buy)" : "None"}
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-xs text-gray-500 dark:text-gray-400">Ribbon Status</span>
						</div>
						<span
							className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRibbonStatusColor(
								data?.ribbonStatus ?? "neutral"
							)}`}
						>
							{getRibbonStatusLabel(data?.ribbonStatus ?? "neutral")}
						</span>
					</div>
				</div>

				{/* Ribbon Explanation */}
				<div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
					<h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Hash Ribbon Signal</h4>
					<p className="text-xs text-gray-500 dark:text-gray-400">
						When the 30-day SMA crosses above the 60-day SMA after a capitulation period, it signals that miners are
						recovering and historically precedes price rallies.
					</p>
				</div>

				{/* Chart */}
				<div ref={chartContainerRef} className="w-full" />

				{/* Legend */}
				<div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
					<span className="flex items-center gap-1">
						<div className="w-3 h-0.5 bg-blue-500"></div>
						Hash Rate
					</span>
					<span className="flex items-center gap-1">
						<div className="w-3 h-0.5 bg-green-500" style={{ borderTop: "2px dashed" }}></div>
						30D SMA
					</span>
					<span className="flex items-center gap-1">
						<div className="w-3 h-0.5 bg-red-500" style={{ borderTop: "2px dashed" }}></div>
						60D SMA
					</span>
				</div>
			</div>
		</div>
	);
};
