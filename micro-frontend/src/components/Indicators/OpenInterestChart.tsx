import React, { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries, HistogramSeries } from "lightweight-charts";
import type { OpenInterestData } from "../../types/AdvancedIndicators";
import { BarChart3, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface OpenInterestChartProps {
	data: OpenInterestData | null;
	isLoading: boolean;
}

export const OpenInterestChart: React.FC<OpenInterestChartProps> = ({ data, isLoading }) => {
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

		// OI Line
		const oiSeries = chart.addSeries(AreaSeries, {
			lineColor: "#f59e0b",
			topColor: "rgba(245, 158, 11, 0.4)",
			bottomColor: "rgba(245, 158, 11, 0.0)",
			lineWidth: 2,
		});

		// 30d Change as histogram
		const changeSeries = chart.addSeries(HistogramSeries, {
			color: "#10b981",
			priceScaleId: "change",
		});

		chart.priceScale("change").applyOptions({
			scaleMargins: { top: 0.8, bottom: 0 },
		});

		const oiData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.openInterest / 1e9,
		}));

		const changeData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.change30d,
			color: d.change30d >= 40 ? "#ef4444" : d.change30d <= -15 ? "#10b981" : "#6b7280",
		}));

		oiSeries.setData(oiData);
		changeSeries.setData(changeData);
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

	const formatOI = (value: number) => {
		if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
		return `$${(value / 1e6).toFixed(0)}M`;
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "overheated":
				return "text-red-500 bg-red-500/10";
			case "flushed":
				return "text-green-500 bg-green-500/10";
			default:
				return "text-yellow-500 bg-yellow-500/10";
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "overheated":
				return "Local Top Risk";
			case "flushed":
				return "Local Bottom Signal";
			default:
				return "Normal Range";
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
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Derivatives Open Interest</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Leverage flush indicator</p>
					</div>
					<BarChart3 className="w-6 h-6 text-amber-500" />
				</div>
			</div>

			<div className="p-6">
				{/* Stats */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<BarChart3 className="w-4 h-4 text-amber-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Total OI</span>
						</div>
						<p className="text-lg font-bold text-gray-900 dark:text-white">{formatOI(data?.totalOI ?? 0)}</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							{(data?.oiChange30d ?? 0) >= 0 ? (
								<TrendingUp className="w-4 h-4 text-green-500" />
							) : (
								<TrendingDown className="w-4 h-4 text-red-500" />
							)}
							<span className="text-xs text-gray-500 dark:text-gray-400">30D Change</span>
						</div>
						<p
							className={`text-lg font-bold ${
								(data?.oiChange30d ?? 0) >= 40
									? "text-red-500"
									: (data?.oiChange30d ?? 0) <= -15
										? "text-green-500"
										: "text-gray-900 dark:text-white"
							}`}
						>
							{(data?.oiChange30d ?? 0) >= 0 ? "+" : ""}
							{data?.oiChange30d.toFixed(1)}%
						</p>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							{(data?.oiChange30d ?? 0) >= 40
								? "⚠️ Overheated"
								: (data?.oiChange30d ?? 0) <= -15
									? "✅ Flushed"
									: "Normal"}
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<TrendingUp className="w-4 h-4 text-blue-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">YoY Change</span>
						</div>
						<p className={`text-lg font-bold ${(data?.oiChangeYoY ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
							{(data?.oiChangeYoY ?? 0) >= 0 ? "+" : ""}
							{data?.oiChangeYoY.toFixed(1)}%
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<AlertTriangle className="w-4 h-4 text-amber-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
						</div>
						<span
							className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(
								data?.status ?? "normal"
							)}`}
						>
							{getStatusLabel(data?.status ?? "normal")}
						</span>
					</div>
				</div>

				{/* Threshold Guide */}
				<div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
					<h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Signal Thresholds</h4>
					<div className="flex items-center gap-4 text-xs">
						<span className="flex items-center gap-1">
							<div className="w-3 h-3 rounded bg-red-500"></div>
							&gt;+40%: Local Top
						</span>
						<span className="flex items-center gap-1">
							<div className="w-3 h-3 rounded bg-gray-500"></div>
							Normal Range
						</span>
						<span className="flex items-center gap-1">
							<div className="w-3 h-3 rounded bg-green-500"></div>
							&lt;-15%: Local Bottom
						</span>
					</div>
				</div>

				{/* Chart */}
				<div ref={chartContainerRef} className="w-full" />
			</div>
		</div>
	);
};
