import { useState } from 'react';
import { BarChart3, PieChart, DollarSign, Activity, Hash } from 'lucide-react';
import { FinancialChart } from '../components/Chart/FinancialChart';
import type { Interval } from '../types/OhlcData';
import { useIndicatorsData } from '../hooks/useIndicatorsData';
import { MetricCard, NewsItem } from '../components';
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
} as const;

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Insights Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Real-time market data and sentiment analysis</p>
          </div>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Crypto Market Overview</h2>
              
              <div className="flex bg-gray-100 rounded-lg p-1">
                {chartTabs.map((tab) => (
                  <button
                    value={selectedAsset}
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSelectedAsset(tabToAssetMap[tab.id]);
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
                   
          {/* Time Interval Picker */}
          <div className="py-3 border-white bg-white">
            <div className="flex items-center justify-center">
              <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                {supportedIntervals.map((intervalOption) => (
                  <button
                    key={intervalOption.value}
                    onClick={() => setInterval(intervalOption.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      interval === intervalOption.value
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Latest Market News</h2>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100">
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
}