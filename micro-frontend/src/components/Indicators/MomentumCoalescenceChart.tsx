import React, { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries } from "lightweight-charts";
import type { MomentumCoalescenceData } from "../../types/AdvancedIndicators";
import { Gauge, Activity, BarChart2, Zap } from "lucide-react";

interface MomentumCoalescenceChartProps {
	data: MomentumCoalescenceData | null;
	isLoading: boolean;
}

export const MomentumCoalescenceChart: React.FC<MomentumCoalescenceChartProps> = ({ data, isLoading }) => {
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

		const compositeData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.compositeScore,
		}));

		areaSeries.setData(compositeData);
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
			case "strong_buy":
				return "text-green-500 bg-green-500/10";
			case "buy":
				return "text-emerald-500 bg-emerald-500/10";
			case "neutral":
				return "text-yellow-500 bg-yellow-500/10";
			case "sell":
				return "text-orange-500 bg-orange-500/10";
			case "strong_sell":
				return "text-red-500 bg-red-500/10";
			default:
				return "text-gray-500 bg-gray-500/10";
		}
	};

	const getSignalLabel = (signal: string) => {
		return signal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	};

	const getScoreColor = (score: number) => {
		if (score >= 70) return "text-green-500";
		if (score >= 50) return "text-yellow-500";
		if (score >= 30) return "text-orange-500";
		return "text-red-500";
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
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Momentum Coalescence</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">4-component proprietary momentum blend</p>
					</div>
					<Gauge className="w-6 h-6 text-purple-500" />
				</div>
			</div>

			<div className="p-6">
				{/* Main Score */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<p className="text-sm text-gray-500 dark:text-gray-400">Composite Score</p>
						<p className={`text-4xl font-bold ${getScoreColor(data?.compositeScore ?? 0)}`}>
							{data?.compositeScore.toFixed(0)}
						</p>
					</div>
					<span className={`px-4 py-2 rounded-full text-lg font-semibold ${getSignalColor(data?.signal ?? "neutral")}`}>
						{getSignalLabel(data?.signal ?? "neutral")}
					</span>
				</div>

				{/* Components Grid */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<Zap className="w-4 h-4 text-blue-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Fast ROC (14d)</span>
						</div>
						<p
							className={`text-lg font-bold ${
								(data?.components.fastROC ?? 0) >= 0 ? "text-green-500" : "text-red-500"
							}`}
						>
							{(data?.components.fastROC ?? 0) >= 0 ? "+" : ""}
							{data?.components.fastROC.toFixed(1)}%
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<Activity className="w-4 h-4 text-purple-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Slow ROC (50d)</span>
						</div>
						<p
							className={`text-lg font-bold ${
								(data?.components.slowROC ?? 0) >= 0 ? "text-green-500" : "text-red-500"
							}`}
						>
							{(data?.components.slowROC ?? 0) >= 0 ? "+" : ""}
							{data?.components.slowROC.toFixed(1)}%
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<BarChart2 className="w-4 h-4 text-amber-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Volume Delta</span>
						</div>
						<p
							className={`text-lg font-bold ${
								(data?.components.volumeDelta ?? 50) >= 50 ? "text-green-500" : "text-red-500"
							}`}
						>
							{data?.components.volumeDelta.toFixed(0)}
						</p>
						<p className="text-xs text-gray-400">{(data?.components.volumeDelta ?? 50) >= 50 ? "Buying" : "Selling"}</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<Gauge className="w-4 h-4 text-cyan-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Vol. Bias</span>
						</div>
						<p
							className={`text-lg font-bold ${
								(data?.components.volatilityBias ?? 0) >= 0.5 ? "text-green-500" : "text-red-500"
							}`}
						>
							{data?.components.volatilityBias.toFixed(2)}
						</p>
						<p className="text-xs text-gray-400">
							{(data?.components.volatilityBias ?? 0) >= 0.5 ? "Bullish" : "Bearish"}
						</p>
					</div>
				</div>

				{/* Score Breakdown */}
				<div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
					<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Score Breakdown</h4>
					<div className="space-y-2">
						{[
							{ label: "Fast ROC", value: Math.min(100, Math.max(0, 50 + (data?.components.fastROC ?? 0) * 2)) },
							{ label: "Slow ROC", value: Math.min(100, Math.max(0, 50 + (data?.components.slowROC ?? 0))) },
							{ label: "Volume Delta", value: data?.components.volumeDelta ?? 50 },
							{ label: "Volatility Bias", value: (data?.components.volatilityBias ?? 0.5) * 100 },
						].map((component) => (
							<div key={component.label} className="flex items-center gap-3">
								<span className="text-xs text-gray-500 dark:text-gray-400 w-24">{component.label}</span>
								<div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
									<div
										className={`h-full rounded-full ${component.value >= 50 ? "bg-green-500" : "bg-red-500"}`}
										style={{ width: `${component.value}%` }}
									/>
								</div>
								<span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8">
									{component.value.toFixed(0)}
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Chart */}
				<div ref={chartContainerRef} className="w-full" />
			</div>
		</div>
	);
};
