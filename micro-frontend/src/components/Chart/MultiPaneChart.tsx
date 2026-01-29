import React, { useEffect, useRef } from "react";
import {
	createChart,
	ColorType,
	CandlestickSeries,
	HistogramSeries,
	LineSeries,
	CrosshairMode,
	LineStyle,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, Time, CandlestickData, HistogramData } from "lightweight-charts";
import type { OhlcData } from "../../types/OhlcData";
import { useTheme } from "../../contexts/ThemeContext";

interface MultiPaneChartProps {
	priceData: OhlcData[];
	showBollingerBands?: boolean;
}

// Bollinger Bands calculation
const calculateBollingerBands = (data: OhlcData[], period = 20, multiplier = 2) => {
	const bands: { time: Time; upper: number; middle: number; lower: number }[] = [];

	// Sort data chronologically first (oldest to newest)
	const sortedData = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

	for (let i = period - 1; i < sortedData.length; i++) {
		const slice = sortedData.slice(i - period + 1, i + 1);
		const closes = slice.map((d) => d.close);
		const sma = closes.reduce((a, b) => a + b, 0) / period;
		const squaredDiffs = closes.map((c) => Math.pow(c - sma, 2));
		const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);

		bands.push({
			time: (new Date(sortedData[i].timestamp).getTime() / 1000) as Time,
			upper: sma + multiplier * stdDev,
			middle: sma,
			lower: sma - multiplier * stdDev,
		});
	}

	return bands;
};

// Theme colors
const getThemeColors = (isDark: boolean) => ({
	background: isDark ? "#1f2937" : "#ffffff",
	textColor: isDark ? "#f3f4f6" : "#374151",
	gridColor: isDark ? "#374151" : "#f3f4f6",
	borderColor: isDark ? "#4b5563" : "#d1d5db",
	volumeUpColor: isDark ? "rgba(34, 197, 94, 0.4)" : "rgba(16, 185, 129, 0.4)",
	volumeDownColor: isDark ? "rgba(248, 113, 113, 0.4)" : "rgba(239, 68, 68, 0.4)",
	upColor: isDark ? "#22c55e" : "#10b981",
	downColor: isDark ? "#f87171" : "#ef4444",
	bollingerUpper: isDark ? "rgba(251, 191, 36, 0.6)" : "rgba(245, 158, 11, 0.6)",
	bollingerMiddle: isDark ? "rgba(251, 191, 36, 0.9)" : "rgba(245, 158, 11, 0.9)",
	bollingerLower: isDark ? "rgba(251, 191, 36, 0.6)" : "rgba(245, 158, 11, 0.6)",
});

const formatPriceData = (data: OhlcData[], isDark: boolean) => {
	const candlestickData: CandlestickData[] = [];
	const volumeData: HistogramData[] = [];
	const colors = getThemeColors(isDark);

	for (const d of data) {
		// Skip invalid data points
		if (
			d.open === null ||
			d.high === null ||
			d.low === null ||
			d.close === null ||
			isNaN(d.open) ||
			isNaN(d.high) ||
			isNaN(d.low) ||
			isNaN(d.close)
		) {
			continue;
		}

		const time = (new Date(d.timestamp).getTime() / 1000) as Time;

		candlestickData.push({
			time,
			open: d.open,
			high: d.high,
			low: d.low,
			close: d.close,
		});

		if (d.volume !== null && d.volume !== undefined && d.volume > 0 && !isNaN(d.volume)) {
			volumeData.push({
				time,
				value: d.volume,
				color: d.close >= d.open ? colors.volumeUpColor : colors.volumeDownColor,
			});
		}
	}

	candlestickData.sort((a, b) => (a.time as number) - (b.time as number));
	volumeData.sort((a, b) => (a.time as number) - (b.time as number));

	return { candlestickData, volumeData };
};

export const MultiPaneChart: React.FC<MultiPaneChartProps> = ({ priceData, showBollingerBands = true }) => {
	const { theme } = useTheme();
	const isDark = theme === "dark";

	// Price chart refs
	const priceContainerRef = useRef<HTMLDivElement>(null);
	const priceChartRef = useRef<IChartApi | null>(null);
	const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
	const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
	const bbMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
	const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

	// Check if we have valid data
	const hasValidData = priceData && priceData.length > 0;

	// Initialize charts
	useEffect(() => {
		if (!priceContainerRef.current || !hasValidData) return;

		// Clean up any existing charts first
		if (priceChartRef.current) {
			priceChartRef.current.remove();
			priceChartRef.current = null;
			candlestickSeriesRef.current = null;
			volumeSeriesRef.current = null;
			bbUpperRef.current = null;
			bbMiddleRef.current = null;
			bbLowerRef.current = null;
		}

		const colors = getThemeColors(isDark);
		const priceRect = priceContainerRef.current.getBoundingClientRect();

		// Wait for container to have dimensions
		if (priceRect.width === 0 || priceRect.height === 0) {
			return;
		}

		// Create price chart
		priceChartRef.current = createChart(priceContainerRef.current, {
			width: priceRect.width,
			height: priceRect.height,
			layout: {
				background: { type: ColorType.Solid, color: colors.background },
				textColor: colors.textColor,
			},
			grid: {
				vertLines: { color: colors.gridColor },
				horzLines: { color: colors.gridColor },
			},
			timeScale: {
				borderColor: colors.borderColor,
				timeVisible: true,
				barSpacing: 12,
			},
			crosshair: {
				mode: CrosshairMode.Normal,
				vertLine: { labelVisible: true },
				horzLine: { labelVisible: true },
			},
			rightPriceScale: {
				borderColor: colors.borderColor,
			},
		});

		// Add candlestick series
		candlestickSeriesRef.current = priceChartRef.current.addSeries(CandlestickSeries, {
			upColor: colors.upColor,
			downColor: colors.downColor,
			borderDownColor: colors.downColor,
			borderUpColor: colors.upColor,
			wickDownColor: colors.downColor,
			wickUpColor: colors.upColor,
		});

		// Add volume series
		volumeSeriesRef.current = priceChartRef.current.addSeries(HistogramSeries, {
			priceFormat: { type: "volume" },
			priceScaleId: "volume_scale",
		});

		priceChartRef.current.priceScale("volume_scale").applyOptions({
			scaleMargins: { top: 0.85, bottom: 0 },
		});

		// Add Bollinger Bands if enabled
		if (showBollingerBands) {
			bbUpperRef.current = priceChartRef.current.addSeries(LineSeries, {
				color: colors.bollingerUpper,
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				priceScaleId: "right",
				crosshairMarkerVisible: false,
			});

			bbMiddleRef.current = priceChartRef.current.addSeries(LineSeries, {
				color: colors.bollingerMiddle,
				lineWidth: 1,
				priceScaleId: "right",
				crosshairMarkerVisible: false,
			});

			bbLowerRef.current = priceChartRef.current.addSeries(LineSeries, {
				color: colors.bollingerLower,
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				priceScaleId: "right",
				crosshairMarkerVisible: false,
			});
		}

		// Update data
		const { candlestickData, volumeData } = formatPriceData(priceData, isDark);
		candlestickSeriesRef.current?.setData(candlestickData);
		volumeSeriesRef.current?.setData(volumeData);

		// Calculate and set Bollinger Bands
		if (
			showBollingerBands &&
			priceData.length >= 20 &&
			bbUpperRef.current &&
			bbMiddleRef.current &&
			bbLowerRef.current
		) {
			const bands = calculateBollingerBands(priceData);
			const sortedBands = bands
				.filter(
					(b) =>
						!isNaN(b.upper) &&
						!isNaN(b.middle) &&
						!isNaN(b.lower) &&
						isFinite(b.upper) &&
						isFinite(b.middle) &&
						isFinite(b.lower)
				)
				.sort((a, b) => (a.time as number) - (b.time as number));

			if (sortedBands.length > 0) {
				bbUpperRef.current.setData(sortedBands.map((b) => ({ time: b.time, value: b.upper })));
				bbMiddleRef.current.setData(sortedBands.map((b) => ({ time: b.time, value: b.middle })));
				bbLowerRef.current.setData(sortedBands.map((b) => ({ time: b.time, value: b.lower })));
			}
		}

		// Fit content
		try {
			priceChartRef.current?.timeScale().fitContent();
		} catch {
			// Ignore fit errors
		}

		// Resize observer
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (entry.target === priceContainerRef.current) {
					priceChartRef.current?.resize(width, height);
				}
			}
		});

		resizeObserver.observe(priceContainerRef.current);

		return () => {
			resizeObserver.disconnect();
			if (priceChartRef.current) {
				priceChartRef.current.remove();
				priceChartRef.current = null;
			}
		};
	}, [priceData, isDark, showBollingerBands, hasValidData]);

	// Theme update effect
	useEffect(() => {
		const colors = getThemeColors(isDark);

		priceChartRef.current?.applyOptions({
			layout: {
				background: { type: ColorType.Solid, color: colors.background },
				textColor: colors.textColor,
			},
			grid: {
				vertLines: { color: colors.gridColor },
				horzLines: { color: colors.gridColor },
			},
		});

		candlestickSeriesRef.current?.applyOptions({
			upColor: colors.upColor,
			downColor: colors.downColor,
			borderDownColor: colors.downColor,
			borderUpColor: colors.upColor,
			wickDownColor: colors.downColor,
			wickUpColor: colors.upColor,
		});
	}, [isDark]);

	// Show loading state if no data
	if (!hasValidData) {
		return (
			<div
				className="w-full h-[400px] md:h-[450px] rounded-lg flex items-center justify-center"
				style={{
					border: `1px solid ${isDark ? "#374151" : "#f3f4f6"}`,
					backgroundColor: isDark ? "#1f2937" : "#ffffff",
				}}
			>
				<div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
					<div className="animate-pulse flex flex-col items-center">
						<svg
							className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
							/>
						</svg>
						<p className="text-sm font-medium">Loading chart data...</p>
						<p className="text-xs mt-1 opacity-70">Fetching market data from API</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative">
			<div className="absolute top-2 left-2 z-10 flex gap-2 text-xs">
				<span className="px-2 py-1 rounded bg-gray-800/80 text-amber-400">BB (20, 2)</span>
			</div>
			<div
				ref={priceContainerRef}
				className="w-full h-[400px] md:h-[450px] rounded-lg overflow-hidden"
				style={{ border: `1px solid ${isDark ? "#374151" : "#f3f4f6"}` }}
			/>
		</div>
	);
};
