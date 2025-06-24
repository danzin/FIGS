import React, { useState, useEffect } from 'react';
import { FinancialChart } from '../components/Chart/FinancialChart';
import { getOhlcData } from '../api/signalsApi';
import type { OhlcData, Interval, Signal } from '../types/OhlcData';
import { useMetricsData } from '../hooks/useMetricsData';
import { MetricCard } from '../components/MetricCard';

const supportedAssets = [
  { label: 'Bitcoin', value: 'coingecko_bitcoin' },
  { label: 'Ethereum', value: 'coingecko_ethereum' },
  { label: 'Solana', value: 'coingecko_solana' },
];

const supportedIntervals: {label: string, value: Interval}[] = [
  { label: '15 Minutes', value: '15m' },
  { label: '30 Minutes', value: '30m' },
  { label: '1 Hour', value: '1h' },
  { label: '1 Day', value: '1d' },
];

export const DashboardPage: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState(supportedAssets[0].value);
  const [interval, setInterval] = useState<Interval>(supportedIntervals[2].value);
  const [chartData, setChartData] = useState<OhlcData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { metrics, isLoading: metricsLoading, error: metricsError } = useMetricsData();

  useEffect(() => {
    const fetchChartData = async () => {
      setIsLoading(true);
      setError(null);
      try {
          const data = await getOhlcData(selectedAsset, interval);
          setChartData(data);
      } catch (err) {
          console.error("Failed to fetch chart data:", err);
          setError("Failed to load chart data. Please try again.");
      } finally {
          setIsLoading(false);
      }
    };

    fetchChartData();
  }, [selectedAsset, interval]); // Refetch data when selectedAsset changes

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 ">
      { /* Header */}
      <div className="mb-6">
        <h1 className='text-3xl font-bold'>FIGS Dashboard</h1>

      </div>
      
      <div className="flex flex-col space-y-6 ">

      {/* Metrics bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {metricsLoading ? (
            // Show loading placeholders
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-gray-800 p-4 rounded-2xl shadow flex flex-col items-center animate-pulse">
                <div className="h-3 bg-gray-600 rounded w-16 mb-2"></div>
                <div className="h-6 bg-gray-600 rounded w-12"></div>
              </div>
            ))
          ) : metricsError ? (
            // Show error state
            <div className="col-span-full bg-red-900/20 border border-red-800 p-4 rounded-2xl">
              <p className="text-red-400 text-sm text-center">{metricsError}</p>
            </div>
          ) : (
            // Show actual metric cards
            <>
              <MetricCard 
                label="Fear & Greed" 
                signal={metrics.fearGreed as Signal}
                precision={0}
              />
              <MetricCard 
                label="VIX Level" 
                signal={metrics.vix as Signal}
                precision={2}
              />
              <MetricCard 
                label="BTC Dominance" 
                signal={metrics.btcDominance as Signal}
                unit="%"
                precision={1}
              />
              <MetricCard 
                label="Unemployment" 
                signal={metrics.unemployment as Signal}
                unit="%"
                precision={1}
              />
            </>
          )}
        </div>

      {/* Chart section */}
        <div className="flex-row flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <label 
              htmlFor="asset-select" 
              className="text-sm font-medium text-gray-300"
            >
              Select Asset:
            </label>
            <select
              id="asset-select"
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg 
                          focus:ring-blue-500 focus:border-blue-500 block px-3 py-2
                          hover:bg-gray-700 transition-colors"
            >
              {supportedAssets.map(asset => (
                <option key={asset.value} value={asset.value}>
                  {asset.label}
                </option>
              ))}
            </select>
            <label 
              htmlFor="interval-select" 
              className="text-sm font-medium text-gray-300"
            >
              Interval:
            </label>
            <select
              id="interval-select"
              value={interval}
              onChange={(e) => setInterval(e.target.value as Interval)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg 
                          focus:ring-blue-500 focus:border-blue-500 block px-3 py-2
                          hover:bg-gray-700 transition-colors"
            >
              {supportedIntervals.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          { /* Chart Container */}
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            {isLoading && (
              <div className="flex items-center justify-center h-96">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <p className="text-gray-300">Loading chart...</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="flex items-center justify-center h-96">
                <p className="text-red-400 bg-red-900/20 px-4 py-2 rounded-lg border border-red-800">
                  {error}
                </p>
              </div>
            )}
            
            {!isLoading && !error && (
              <div className="h-96 lg:h-[600px]">
                <FinancialChart data={chartData} />
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};