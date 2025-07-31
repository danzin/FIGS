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

interface FinancialChartProps {
  data: OhlcData[];
}

const formatDataForChart = (data: OhlcData[]) => {
  const candlestickData: CandlestickData[] = [];
  const volumeData: HistogramData[] = [];

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
        color: d.close >= d.open
          ? 'rgba(16, 185, 129, 0.4)'  // Light emerald for up candles
          : 'rgba(239, 68, 68, 0.4)',  // Light red for down candles
      });
    }
  }

  // Sort ascending by time
  candlestickData.sort((a, b) => (a.time as number) - (b.time as number));
  volumeData.sort((a, b) => (a.time as number) - (b.time as number));

  return { candlestickData, volumeData };
};

export const FinancialChart: React.FC<FinancialChartProps> = ({ data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const { width, height } = chartContainerRef.current.getBoundingClientRect(); //fluid width and height on init on each resize
    const isMobile = width < 640;

    // chart instance once
    if (!chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: '#ffffff' }, // Pure white background
          textColor: '#374151', // Dark gray text (tailwind gray-700)
        },
        grid: {
          vertLines: { color: isMobile ? 'transparent' : '#f3f4f6' }, // Light gray grid (tailwind gray-100)
          horzLines: { color: '#f3f4f6' }, // Light gray horizontal lines
        },
        timeScale: {
          borderColor: '#d1d5db', // Light gray border (tailwind gray-300)
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
          borderColor: '#d1d5db', // Light gray border (tailwind gray-300)
          autoScale: true,
        },
      });

      // Add candlestick series via addSeries
      candlestickSeriesRef.current = chartRef.current.addSeries(
        CandlestickSeries,
        {
          upColor: '#10b981', // Emerald green (tailwind emerald-500)
          downColor: '#ef4444', // Red (tailwind red-500) 
          borderDownColor: '#ef4444',
          borderUpColor: '#10b981',
          wickDownColor: '#ef4444',
          wickUpColor: '#10b981',
        }
      );

      // Add Histogram for volume series via addSeries(only if volume data is available)
      volumeSeriesRef.current = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume_scale',
          color: 'rgba(16, 185, 129, 0.3)', // Semi-transparent emerald
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
    const { candlestickData, volumeData } = formatDataForChart(data);

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
    }
    });
    resizeObs.observe(chartContainerRef.current);

    return () => {
      resizeObs.disconnect();
    };
  }, [data]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={chartContainerRef}
      className='relative w-full h-[50vh] md:h-[600px]'
    />
  );
};
