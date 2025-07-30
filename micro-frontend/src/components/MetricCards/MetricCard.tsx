import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'; 
import { IndicatorData } from '../../types/Indicators';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface MetricCardProps {
  label: string;
  indicator?: IndicatorData;
  icon: React.ReactNode;
  unit?: string;
  precision?: number;
}

interface EnhancedMetricCardProps {
  label: string; 
  value?: number;
  unit?: string;
  change?: number;
  changePercent?: number;
  precision?: number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  isPositive?: boolean;
}

export const EnhancedMetricCard: React.FC<EnhancedMetricCardProps> = ({ 
  label, 
  value, 
  unit = '', 
  change, 
  changePercent, 
  precision = 2, 
  description, 
  icon: Icon,
  isPositive 
}) => {
  const displayValue = value !== undefined ? value.toFixed(precision) : '--';
  if(changePercent === undefined) {
    console.error('EnhancedMetricCard: changePercent is undefined');
    changePercent = 0;
  }
  const isChangePositive = changePercent > 0;
  
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 flex-1 flex flex-col h-40">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`p-2 rounded-lg ${
              label.includes('Fear') ? 'bg-blue-50' :
              label.includes('VIX') ? 'bg-purple-50' :
              label.includes('BTC') ? 'bg-orange-50' :
              label.includes('SPY') ? 'bg-green-50' :
              'bg-gray-50'
            }`}>
              <Icon className={`h-5 w-5 ${
                label.includes('Fear') ? 'text-blue-600' :
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
      
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          {unit === '$' && <span className="text-lg font-semibold text-gray-900">{unit}</span>}
          <span className="text-2xl font-bold text-gray-900">{displayValue}</span>
          {unit !== '$' && unit && <span className="text-lg font-semibold text-gray-900">{unit}</span>}
        </div>
        
        {changePercent !== undefined && (
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
            <span>{Math.abs(changePercent).toFixed(1)}%</span>
          </div>
        )}
      </div>
      
      {changePercent !== undefined && (
        <div className="mt-2">
          <span className="text-xs text-gray-500">24h change</span>
        </div>
      )}
    </div>
  );
};

export const MetricCard: React.FC<MetricCardProps> = ({ label, indicator, icon, unit = '', precision = 1 }) => {
  const value = indicator?.value;
  const change = indicator?.change_24h ;

  const displayValue = typeof value === 'number' ? value.toFixed(precision) : '--';
  const displayChange = typeof change === 'number' ? `${change.toFixed(1)}% 24h change` : '...';
  const isPositive = typeof change === 'number' && change >= 0;

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex-1">
      <div className="flex justify-between items-start">
        <span className="text-sm text-gray-400">{label}</span>
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-blue-400">
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <span className="text-3xl font-bold">
          {displayValue}
          <span className="text-2xl">{unit}</span>
        </span>
      </div>
      <div className={`mt-1 text-xs flex items-center ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {typeof change === 'number' && (
          isPositive ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />
        )}
        <span>{displayChange}</span>
      </div>
    </div>
  );
};
