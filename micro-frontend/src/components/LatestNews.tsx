import React from 'react';

interface NewsItemProps {
  title: string;
  source: string;
  time: string;
  sentiment: string;
}

export const NewsItem: React.FC<NewsItemProps> = ({ title, source, time, sentiment }) => (
  
  <div className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
    <div className={`w-1 h-12 rounded-full ${
      sentiment === 'bullish' ? 'bg-green-400' :
      sentiment === 'bearish' ? 'bg-red-400' :
      'bg-blue-400'
    }`} />
    <div className="flex-1 min-w-0">
      <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-5">
        {title}
      </h4>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs text-gray-500">{source}</span>
        <span className="text-xs text-gray-400">•</span>
        <span className="text-xs text-gray-500">{time}</span>
      </div>
    </div>
    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
      sentiment === 'bullish' ? 'bg-green-50 text-green-700' :
      sentiment === 'bearish' ? 'bg-red-50 text-red-700' :
      'bg-blue-50 text-blue-700'
    }`}>
      {sentiment}
    </div>
  </div>
);

