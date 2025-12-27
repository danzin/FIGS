import React, { useEffect, useRef } from "react";
import { createChart, ColorType, LineStyle, LineSeries } from "lightweight-charts";
import type { PowerLawData } from "../../types/AdvancedIndicators";
import { TrendingUp, TrendingDown, Target } from "lucide-react";

interface PowerLawChartProps {
	data: PowerLawData | null;
	isLoading: boolean;
}

export const PowerLawChart: React.FC<PowerLawChartProps> = ({ data, isLoading }) => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

	useEffect(() => {
		if (!chartContainerRef.current || !data) return;

		// Create chart
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
			rightPriceScale: {
				borderVisible: false,
			},
			timeScale: {
				borderVisible: false,
				timeVisible: true,
			},
		});

		chartRef.current = chart;

		// Price line
		const priceSeries = chart.addSeries(LineSeries, {
			color: "#3b82f6",
			lineWidth: 2,
		});

		// Fair value line
		const fairValueSeries = chart.addSeries(LineSeries, {
			color: "#10b981",
			lineWidth: 2,
			lineStyle: LineStyle.Dashed,
		});

		const priceData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.price,
		}));

		const fairValueData = data.historicalData.map((d) => ({
			time: d.timestamp.split("T")[0] as string,
			value: d.fairValue,
		}));

		priceSeries.setData(priceData);
		fairValueSeries.setData(fairValueData);

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

	const getDrawdownColor = (drawdown: number) => {
		if (drawdown < -20) return "text-red-500";
		if (drawdown < 0) return "text-yellow-500";
		if (drawdown < 20) return "text-green-500";
		return "text-red-500";
	};

	const getDrawdownLabel = (drawdown: number) => {
		if (drawdown < -30) return "Deep Undervalued";
		if (drawdown < -10) return "Undervalued";
		if (drawdown < 10) return "Fair Value";
		if (drawdown < 30) return "Overvalued";
		return "Extremely Overvalued";
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
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Power Law Model</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Long-term logarithmic regression valuation</p>
					</div>
					<div className="flex items-center gap-2 text-xs">
						<span className="flex items-center gap-1">
							<div className="w-3 h-0.5 bg-blue-500"></div>
							Price
						</span>
						<span className="flex items-center gap-1">
							<div className="w-3 h-0.5 bg-green-500" style={{ borderTop: "2px dashed" }}></div>
							Fair Value
						</span>
					</div>
				</div>
			</div>

			<div className="p-6">
				{/* Stats */}
				<div className="grid grid-cols-3 gap-4 mb-6">
					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<TrendingUp className="w-4 h-4 text-blue-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Current Price</span>
						</div>
						<p className="text-xl font-bold text-gray-900 dark:text-white">${data?.currentPrice.toLocaleString()}</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<Target className="w-4 h-4 text-green-500" />
							<span className="text-xs text-gray-500 dark:text-gray-400">Fair Value</span>
						</div>
						<p className="text-xl font-bold text-gray-900 dark:text-white">
							${data?.fairValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
						</p>
					</div>

					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							{(data?.drawdown ?? 0) >= 0 ? (
								<TrendingUp className="w-4 h-4 text-green-500" />
							) : (
								<TrendingDown className="w-4 h-4 text-red-500" />
							)}
							<span className="text-xs text-gray-500 dark:text-gray-400">Deviation</span>
						</div>
						<p className={`text-xl font-bold ${getDrawdownColor(data?.drawdown ?? 0)}`}>
							{(data?.drawdown ?? 0) >= 0 ? "+" : ""}
							{data?.drawdown.toFixed(1)}%
						</p>
						<p className={`text-xs mt-1 ${getDrawdownColor(data?.drawdown ?? 0)}`}>
							{getDrawdownLabel(data?.drawdown ?? 0)}
						</p>
					</div>
				</div>

				{/* Chart */}
				<div ref={chartContainerRef} className="w-full" />

				{/* Formula */}
				<div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
					<p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
						log(Price) = {data?.intercept.toFixed(2)} + {data?.slope.toFixed(2)} × log(Days Since Genesis)
					</p>
					<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
						Days: {data?.daysSinceGenesis.toLocaleString()}
					</p>
				</div>
			</div>
		</div>
	);
};
