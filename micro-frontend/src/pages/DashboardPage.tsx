import { useState } from 'react';
import { RefreshCw, BarChart3, PieChart, DollarSign, Activity, Hash } from 'lucide-react';
import { FinancialChart } from '../components/Chart/FinancialChart';
import type { Interval } from '../types/OhlcData';
import { useIndicatorsData } from '../hooks/useIndicatorsData';
import { MetricCard, NewsItem } from '../components';
import { useOhlcData } from '../hooks/useOhlcData';
const supportedIntervals: {label: string, value: Interval}[] = [
  { label: '15 Minutes', value: '15m' },
  { label: '1 Hour', value: '1h' },
  { label: '1 Day', value: '1d' },
];



// Mock news
const mockNews = [
  { source: 'CoinDesk', title: 'Bitcoin Surges Past $42,000 as Institutional Investors Flood In', time: '2 hours ago', sentiment: 'bullish' },
  { source: 'Bloomberg Crypto', title: 'Regulatory Crackdown Fears Cause Altcoin Market to Plummet', time: '5 hours ago', sentiment: 'bearish' },
  { source: 'Financial Times', title: 'Fed Chair Powell Suggests Rate Cuts May Come Later Than Expected', time: '8 hours ago', sentiment: 'neutral' },
  { source: 'The Block', title: 'Ethereum ETF Approval Rumors Spark Rally in ETH and L2 Tokens', time: '12 hours ago', sentiment: 'bullish' },
  { source: 'CryptoSlate', title: 'Major Exchange Hack Results in $200M Loss, Market Reacts Negatively', time: '14 hours ago', sentiment: 'bearish' },
];





const chartTabs = [
  { id: 'btc', label: 'BTC', active: true },
  { id: 'eth', label: 'ETH', active: false },
  { id: 'sol', label: 'SOL', active: false },

];

export const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState('bitcoin');
  const [selectedAsset, setSelectedAsset] = useState("bitcoin");
  const [interval, _setInterval] = useState<Interval>(supportedIntervals[2].value);

 const { indicators, isLoading: _indicatorsLoading, error: _indicatorsError } = useIndicatorsData();
// Mock data

const tabToAssetMap: Record<string, string> = {
  'btc': 'bitcoin',
  'eth': 'ethereum',
  'sol': 'solana'
} as const;

const mockMetrics = [
  {
    label: "BTC Dominance",
    value: indicators.btcDominance?.value || 0,
    precision: 2,
    unit: "%",
    changePercent: 1.2,
    description: "Bitcoin market cap dominance",
    icon: BarChart3
  },
    {
    label: "Coinbase Rank",
    value: indicators.coinbaseRank?.value || 0,
    precision: 0,
    unit: "",
    changePercent: null,
    description: "Coinbase AppStore Rank",
    icon: Hash
  },
  {
    label: "VIX Level", 
    value: indicators.vix?.value || 0,
    changePercent: -0.8,
    precision: 2,
    description: "Volatility of the U.S. stock market",
    icon: Activity
  },
  {
    label: "SPY Price",
    value: indicators.spy?.value || 0,
    unit: "$",
    precision: 2,
    changePercent: 1.4,
    description: "SPDR S&P 500 ETF",
    icon: DollarSign
  },
  {
    label: "Fear & Greed Index",
    value: indicators.fearGreedIndex?.value || 0,
    precision: 0,
    changePercent: 2.1,
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
  console.log('Chart Data:', chartData);
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Insights Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Real-time market data and sentiment analysis</p>
          </div>
          
          <div className="flex items-center gap-4">

            
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Metrics Cards */}
        <div className="flex flex-col sm:flex-row gap-6">
          {mockMetrics.map((metric, index) => (
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
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View all →
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100">
            {mockNews.map((news, index) => (
              <NewsItem
                key={index}
                title={news.title}
                source={news.source}
                time={news.time}
                sentiment={news.sentiment}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}