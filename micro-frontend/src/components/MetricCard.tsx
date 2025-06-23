import React from 'react';
import type { Signal } from '../types/OhlcData';

interface MetricCardProps {
  label: string;
  signal?: Signal; 
  unit?: string;  
  precision?: number; 
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  signal,
  unit = '',
  precision = 2
}) => {
  const displayValue = signal?.value !== undefined ? signal.value.toFixed(precision) : '--';
  const displayTime = signal?.time ? new Date(signal.time).toLocaleTimeString() : '';

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md flex flex-col items-center justify-center text-center h-full">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="mt-1 text-2xl font-semibold">
        {unit === '$' && <span className="text-lg align-top">{unit}</span>}
        {displayValue}
        {unit !== '$' && <span className="text-lg">{unit}</span>}
      </span>
      {displayTime && (
        <span className="text-xs text-gray-500 mt-1">
          {displayTime}
        </span>
      )}
    </div>
  );
};