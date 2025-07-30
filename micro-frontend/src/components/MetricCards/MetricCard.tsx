import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'; // npm install @heroicons/react
import { IndicatorData } from '../../types/Indicators'; // Your indicator type

interface MetricCardProps {
  label: string;
  indicator?: IndicatorData;
  icon: React.ReactNode;
  unit?: string;
  precision?: number;
}

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
