import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';


interface MetricCardProps {
  label: string;
  value?: number | null;
  unit?: string;
  change?: number;
  changePercent?: number | null;
  precision?: number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  isPositive?: boolean;
}

type Sentiment = {
  label: string;
  color: string;
  width: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  change,
  changePercent,
  precision = 2,
  description,
  icon: Icon,
  isPositive,
}) => {
  const isFearGreed = label.toLowerCase().includes('fear') || label.toLowerCase().includes('greed');
  
  const displayValue = value !== undefined && value !== null ? value.toFixed(precision) : '--';
  
  // Fear & Greed specific logic
  const getSentiment = (val?: number | null): Sentiment => {
    if (typeof val !== 'number' || val === null) return { label: 'Neutral', color: 'bg-gray-500', width: '50%' };
    if (val < 25) return { label: 'Extreme Fear', color: 'bg-red-500', width: '15%' };
    if (val < 45) return { label: 'Fear', color: 'bg-yellow-500', width: '35%' };
    if (val < 55) return { label: 'Neutral', color: 'bg-gray-400', width: '50%' };
    if (val < 75) return { label: 'Greed', color: 'bg-green-400', width: '65%' };
    return { label: 'Extreme Greed', color: 'bg-green-600', width: '85%' };
  };

  const sentiment = isFearGreed ? getSentiment(value) : null;
  
  const normalizedChangePercent = changePercent ?? 0;
  const isChangePositive = normalizedChangePercent > 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 flex-1 flex flex-col h-40">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`p-2 rounded-lg ${
              isFearGreed ? 'bg-blue-50' :
              label.includes('VIX') ? 'bg-purple-50' :
              label.includes('BTC') ? 'bg-orange-50' :
              label.includes('SPY') ? 'bg-green-50' :
              'bg-gray-50'
            }`}>
              <Icon className={`h-5 w-5 ${
                isFearGreed ? 'bg-blue-600' :
                label.includes('VIX') ? 'text-purple-600' :
                label.includes('BTC') ? 'text-orange-600' :
                label.includes('SPY') ? 'text-green-600' :
                'text-gray-600'
              }`} />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-600">{label}</h3>
            {description && (
              <p className="text-xs text-gray-400 mt-1">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Value Section */}
      <div className="flex items-end justify-between mb-2">
        <div className="flex items-baseline gap-1">
          {unit === '$' && <span className="text-lg font-semibold text-gray-900">{unit}</span>}
          <span className="text-2xl font-bold text-gray-900">{displayValue}</span>
          {unit !== '$' && unit && <span className="text-lg font-semibold text-gray-900">{unit}</span>}
        </div>
      </div>

      {/* Fear & Greed Special Section OR Change Percentage */}
      {isFearGreed && sentiment ? (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`${sentiment.color} h-2 rounded-full transition-all duration-300`} 
              style={{ width: sentiment.width }}
            ></div>
          </div>
          <div className="text-center text-sm font-semibold mt-1">{sentiment.label}</div>
        </div>
      ) : (
        <div className="flex items-end justify-between">
          {changePercent !== undefined && changePercent !== null && (
            <>
              <div className="mt-2">
                <span className="text-xs text-gray-500">24h change</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                isChangePositive
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {isChangePositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(normalizedChangePercent).toFixed(1)}%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
