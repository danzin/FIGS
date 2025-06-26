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
          ? 'rgba(38, 166, 154, 0.5)'
          : 'rgba(239, 83, 80, 0.5)',
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

    const { width, height } = chartContainerRef.current.getBoundingClientRect();
    const isMobile = width < 640;

    // chart instance once
    if (!chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: '#1a1a1a' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: isMobile ? 'transparent' : '#2b2b30' },
          horzLines: { color: '#2b2b30' },
        },
        timeScale: {
          borderColor: '#485c7b',
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
          borderColor: '#485c7b',
          autoScale: true,
        },
      });

      // Add candlestick series via addSeries
      candlestickSeriesRef.current = chartRef.current.addSeries(
        CandlestickSeries,
        {
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderDownColor: '#ef5350',
          borderUpColor: '#26a69a',
          wickDownColor: '#ef5350',
          wickUpColor: '#26a69a',
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
          color: 'rgba(76, 175, 80, 0.5)',
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
