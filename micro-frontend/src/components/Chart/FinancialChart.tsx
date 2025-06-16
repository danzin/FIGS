import { createChart, LineSeries } from "lightweight-charts";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import React, { useEffect, useRef } from "react";
import type { OhlcData } from "../../types/OhlcData";

interface FinancialChartProps {
	data: OhlcData[];
}

const formatDataForChart = (data: OhlcData[]) => {
	return data
		.map((d) => ({
			time: (new Date(d.bucketed_at).getTime() / 1000) as Time,
			open: d.open_price,
			high: d.high_price,
			low: d.low_price,
			close: d.close_price,
		}))
		.sort((a: any, b: any) => a.time - b.time);
};

export const FinancialChart: React.FC<FinancialChartProps> = ({ data }) => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

	useEffect(() => {
		if (!chartContainerRef.current) return;

		if (!chartRef.current) {
			chartRef.current = createChart(chartContainerRef.current, {
				width: chartContainerRef.current.clientWidth,
				height: 500, 
				layout: {
					background: { color: "#ffffff" },
					textColor: "#333",
				},
				grid: {
					vertLines: { color: "#f0f0f0" },
					horzLines: { color: "#f0f0f0" },
				},
				
			});
			seriesRef.current = chartRef.current.addSeries(LineSeries, { lineWidth: 2 });
		}

		// Update data when props change
		if (data.length > 0) {
			const formattedData = formatDataForChart(data);
			seriesRef.current?.setData(formattedData);
			chartRef.current?.timeScale().fitContent();
		}

		const handleResize = () => {
			if (chartContainerRef.current && chartRef.current) {
				chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
			}
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, [data]); // Rerun effect when data prop changes

	// Cleanup chart on component unmount
	useEffect(() => {
		return () => {
			if (chartRef.current) {
				chartRef.current.remove();
				chartRef.current = null;
			}
		};
	}, []);

	return <div ref={chartContainerRef} />;
};
