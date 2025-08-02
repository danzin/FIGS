import { useState } from 'react';
import { BarChart3, PieChart, DollarSign, Activity, Hash } from 'lucide-react';
import { FinancialChart } from '../components/Chart/FinancialChart';
import type { Interval } from '../types/OhlcData';
import { useIndicatorsData } from '../hooks/useIndicatorsData';
import { MetricCard, NewsItem } from '../components';
import { ThemeToggle } from '../components/ThemeToggle';
import { useOhlcData } from '../hooks/useOhlcData';
import { useMetricChange } from '../hooks/useMetricChange';
import { useLatestNews } from '../hooks/useLatestNews';

const supportedIntervals: {label: string, value: Interval}[] = [
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
];

const chartTabs = [
  { id: 'btc', label: 'BTC', active: true },
  { id: 'eth', label: 'ETH', active: false },
  { id: 'sol', label: 'SOL', active: false },
];

export const DashboardPage = () => {
  
  const [activeTab, setActiveTab] = useState('bitcoin');
  const [selectedAsset, setSelectedAsset] = useState("bitcoin");
  const [interval, setInterval] = useState<Interval>(supportedIntervals[2].value);
  
  const { news, loading: _loadingNews } = useLatestNews();
  const { indicators, isLoading: _indicatorsLoading, error: _indicatorsError } = useIndicatorsData();
  const { data: appStoreRank, loading: _loadingRank } = useMetricChange("Coinbase_Rank", "absolute");
  const { data: fearGreed, loading: _loadingFG } = useMetricChange("fear_greed_index", "percent");
  const { data: btc_dom, loading: _loadingBTCD } = useMetricChange("btc_dominance", "percent");
  const { data: spy, loading: _loadingSpy } = useMetricChange("SPY", "percent");
  const { data: vix, loading: _loadingVix } = useMetricChange("^VIX", "percent");

const tabToAssetMap: Record<string, string> = {
  'btc': 'bitcoin',
  'eth': 'ethereum',
  'sol': 'solana'
}; 

const metrics = [
  {
    label: "BTC Dominance",
    value: indicators.btcDominance?.value || 0,
    precision: 2,
    unit: "%",
    changePercent: btc_dom?.change || null,
    description: "Bitcoin market cap dominance",
    icon: BarChart3
  },
    {
    label: "Coinbase Rank",
    value: indicators.coinbaseRank?.value || 0,
    precision: 0,
    unit: "",
    changePercent: appStoreRank?.change || null,
    description: "Coinbase AppStore Rank",
    icon: Hash
  },
  {
    label: "VIX Level", 
    value: indicators.vix?.value || 0,
    changePercent: vix?.change || null,
    precision: 2,
    description: "Volatility of the U.S. stock market",
    icon: Activity
  },
  {
    label: "SPY Price",
    value: indicators.spy?.value || 0,
    unit: "$",
    precision: 2,
    changePercent: spy?.change || null,
    description: "SPDR S&P 500 ETF",
    icon: DollarSign
  },
  {
    label: "Fear & Greed Index",
    value: indicators.fearGreedIndex?.value || 0,
    precision: 0,
    changePercent: fearGreed?.change || null,
    description: "Neutral",
    icon: PieChart,
    feargreed: true
  }
];

  const {
    data: chartData,
    loading: _chartLoading,
    error: _chartError,
  } = useOhlcData(selectedAsset, interval);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
              Financial Insights Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 transition-colors duration-300">
              Real-time market data and sentiment analysis
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Metrics Cards */}
        <div className="flex flex-col sm:flex-row gap-6">
          {metrics.map((metric, index) => (
            <MetricCard
              key={index}
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              precision={metric.precision}
              changePercent={metric.changePercent}
              description={metric.description}
              icon={metric.icon}
            />
          ))}
        </div>

        {/* Chart Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">
                Crypto Market Overview
              </h2>
              
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 transition-colors duration-300">
                {chartTabs.map((tab) => (
                  <button
                    value={selectedAsset}
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSelectedAsset(tabToAssetMap[tab.id]);
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
                   
          {/* Time Interval Picker */}
          <div className="py-3 border-white dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-300">
            <div className="flex items-center justify-center">
              <div className="flex bg-white dark:bg-gray-700 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-600 transition-colors duration-300">
                {supportedIntervals.map((intervalOption) => (
                  <button
                    key={intervalOption.value}
                    onClick={() => setInterval(intervalOption.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-300 ${
                      interval === intervalOption.value
                        ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {intervalOption.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Chart Placeholder */}
          <div className="p-6">
            <FinancialChart data={chartData} />
          </div>
        </div>

        {/* News Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">
                Latest Market News
              </h2>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors duration-300">
            {news.map((news, index) => (
              <NewsItem
                key={index}
                title={news.title}
                source={news.source}
                time={new Date(news.published_at).toLocaleString()}
                sentiment={news.sentiment}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};