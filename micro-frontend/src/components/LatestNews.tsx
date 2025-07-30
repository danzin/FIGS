import React from 'react';

// Mock data for now
const mockNews = [
  { source: 'CoinDesk', title: 'Bitcoin Surges Past $42,000 as Institutional Investors Flood In', time: '2 hours ago', sentiment: 'bullish' },
  { source: 'Bloomberg Crypto', title: 'Regulatory Crackdown Fears Cause Altcoin Market to Plummet', time: '5 hours ago', sentiment: 'bearish' },
  { source: 'Financial Times', title: 'Fed Chair Powell Suggests Rate Cuts May Come Later Than Expected', time: '8 hours ago', sentiment: 'neutral' },
  { source: 'The Block', title: 'Ethereum ETF Approval Rumors Spark Rally in ETH and L2 Tokens', time: '12 hours ago', sentiment: 'bullish' },
  { source: 'CryptoSlate', title: 'Major Exchange Hack Results in $200M Loss, Market Reacts Negatively', time: '14 hours ago', sentiment: 'bearish' },
];

const sentimentStyles = {
  bullish: 'bg-green-500',
  bearish: 'bg-red-500',
  neutral: 'bg-blue-500',
};
const sentimentTextStyles = {
  bullish: 'text-green-400',
  bearish: 'text-red-400',
  neutral: 'text-blue-400',
};

export const LatestNews: React.FC = () => {
  const isSentimentKey = (key: string): key is keyof typeof sentimentStyles => {
  return key === 'bullish' || key === 'bearish' || key === 'neutral';
};
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Latest Market News</h2>
        <a href="#" className="text-sm text-blue-400 hover:underline">View all</a>
      </div>
      <div className="space-y-4">
        {mockNews.map((item, index) => (
          <div key={index} className="flex items-start space-x-4">
            <div className={`w-1.5 h-12 mt-1 rounded-full ${isSentimentKey(item.sentiment) ? sentimentStyles[item.sentiment] : ''}`}></div>
            <div className="flex-1">
              <p className="text-white font-semibold leading-tight">{item.title}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">{item.source} - {item.time}</span>
                <span className={`text-xs font-bold uppercase ${isSentimentKey(item.sentiment) ? sentimentTextStyles[item.sentiment] : ''}`}>
                  {item.sentiment}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};