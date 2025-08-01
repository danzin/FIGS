import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickData,
  HistogramData,
} from 'lightweight-charts';
import type { OhlcData } from '../../types/OhlcData';
import { useTheme } from '../../contexts/ThemeContext';

interface FinancialChartProps {
  data: OhlcData[];
}

// Theme-specific colors
const getThemeColors = (isDark: boolean) => ({
  background: isDark ? '#1f2937' : '#ffffff',
  textColor: isDark ? '#f3f4f6' : '#374151', 
  gridColor: isDark ? '#374151' : '#f3f4f6',
  borderColor: isDark ? '#4b5563' : '#d1d5db',
  volumeUpColor: isDark ? 'rgba(34, 197, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)', 
  volumeDownColor: isDark ? 'rgba(248, 113, 113, 0.4)' : 'rgba(239, 68, 68, 0.4)', 
  upColor: isDark ? '#22c55e' : '#10b981', 
  downColor: isDark ? '#f87171' : '#ef4444',
});

const formatDataForChart = (data: OhlcData[], isDark: boolean) => {
  const candlestickData: CandlestickData[] = [];
  const volumeData: HistogramData[] = [];
  const colors = getThemeColors(isDark);

  for (const d of data) {
    const time = (new Date(d.timestamp).getTime() / 1000) as Time;

    candlestickData.push({
      time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    });

    if (d.volume !== null && d.volume > 0) {
      volumeData.push({
        time,
        value: d.volume,
        color: d.close >= d.open ? colors.volumeUpColor : colors.volumeDownColor,
      });
    }
  }

  // Sort ascending by time
  candlestickData.sort((a, b) => (a.time as number) - (b.time as number));
  volumeData.sort((a, b) => (a.time as number) - (b.time as number));

  return { candlestickData, volumeData };
};

export const FinancialChart: React.FC<FinancialChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const colors = getThemeColors(isDark);
    
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: chartContainerRef.current && chartContainerRef.current.getBoundingClientRect().width < 640 ? 'transparent' : colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      timeScale: {
        borderColor: colors.borderColor,
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
      },
    });

    if (candlestickSeriesRef.current) {
      candlestickSeriesRef.current.applyOptions({
        upColor: colors.upColor,
        downColor: colors.downColor,
        borderDownColor: colors.downColor,
        borderUpColor: colors.upColor,
        wickDownColor: colors.downColor,
        wickUpColor: colors.upColor,
      });
    }

    if (volumeSeriesRef.current && data.length > 0) {
      const { volumeData } = formatDataForChart(data, isDark);
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [theme, isDark, data]);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const { width, height } = chartContainerRef.current.getBoundingClientRect();
    const isMobile = width < 640;
    const colors = getThemeColors(isDark);

    // Create chart instance once
    if (!chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: colors.background },
          textColor: colors.textColor,
        },
        grid: {
          vertLines: { color: isMobile ? 'transparent' : colors.gridColor },
          horzLines: { color: colors.gridColor },
        },
        timeScale: {
          borderColor: colors.borderColor,
          timeVisible: true,
          barSpacing: isMobile ? 4 : 12,
          minBarSpacing: 2,
          rightOffset: 3,
          lockVisibleTimeRangeOnResize: true,
        },
        crosshair: {
          mode: isMobile ? CrosshairMode.Normal : CrosshairMode.Magnet,
        },
        localization: {
          dateFormat: isMobile ? 'MM/dd' : 'MMM dd, yyyy',
        },
        rightPriceScale: {
          borderColor: colors.borderColor,
          autoScale: true,
        },
      });

      // Add candlestick series
      candlestickSeriesRef.current = chartRef.current.addSeries(
        CandlestickSeries,
        {
          upColor: colors.upColor,
          downColor: colors.downColor,
          borderDownColor: colors.downColor,
          borderUpColor: colors.upColor,
          wickDownColor: colors.downColor,
          wickUpColor: colors.upColor,
        }
      );

      // Add volume histogram series
      volumeSeriesRef.current = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume_scale',
          color: colors.volumeUpColor,
        }
      );

      // Configure volume price scale margins
      chartRef.current.priceScale('volume_scale').applyOptions({
        scaleMargins: {
          top: 0.9,
          bottom: 0,
        },
        autoScale: true,
      });
    }

    // Update data when props change
    const { candlestickData, volumeData } = formatDataForChart(data, isDark);

    candlestickSeriesRef.current?.setData(candlestickData);
    volumeSeriesRef.current?.setData(volumeData);
    chartRef.current.timeScale().fitContent();

    // Handle resize
    // Resize Observer handles resizing much better than window resize events 
    // it watches the chart's wrapper container and resizes the chart accordingly
    const resizeObs = new ResizeObserver(entries => {
      for (let ent of entries) {
        const { width: w, height: h } = ent.contentRect;
        chartRef.current?.resize(w, h);
        
        // Update grid visibility based on new width
        const newIsMobile = w < 640;
        const currentColors = getThemeColors(isDark);
        chartRef.current?.applyOptions({
          grid: {
            vertLines: { color: newIsMobile ? 'transparent' : currentColors.gridColor },
            horzLines: { color: currentColors.gridColor },
          },
        });
      }
    });
    
    resizeObs.observe(chartContainerRef.current);

    return () => {
      resizeObs.disconnect();
    };
  }, [data, isDark]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={chartContainerRef}
      className='relative w-full h-[50vh] md:h-[600px] rounded-lg overflow-hidden transition-all duration-300'
      style={{
        // Add a subtle border that matches the theme
        border: `1px solid ${isDark ? '#374151' : '#f3f4f6'}`,
      }}
    />
  );
};