import React from 'react';
import type { Signal } from '../types/OhlcData';

interface MetricCardProps {
  label: string;
  signal?: Signal; 
  unit?: string;  
  precision?: number; 
  description?: string;
  gradient?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  signal,
  unit = '',
  precision = 2,
  description: descriptionProp,
  gradient = '',
}) => {
  const displayValue = signal?.value !== undefined ? signal.value.toFixed(precision) : '--';
  const displayTime = signal?.time ? new Date(signal.time).toLocaleTimeString() : '';
  let descriptionText: string | undefined = descriptionProp;
  if (signal?.name === 'fear_greed_index' && signal.value !== undefined) {
    switch (true) {
      case signal.value < 20:
      descriptionText = 'Extreme Fear';
      break;
    case signal.value < 40:
      descriptionText = 'Fear';
      break;
    case signal.value < 60:
      descriptionText = 'Neutral';
      break;
    case signal.value < 80:
      descriptionText = 'Greed';
      break;
    case signal.value <= 100:
      descriptionText = 'Extreme Greed';
      break;
    default:
      descriptionText = descriptionProp;
    }
  }
  return (
     <div className="bg-gray-800 p-4 rounded-lg shadow-md flex flex-col justify-between flex-1 min-w-0 text-center h-full">
      <div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>

      <div>
        <span className="mt-1 text-2xl font-semibold">
          {unit === '$' && <span className="text-lg align-top">{unit}</span>}
          {displayValue}
          {unit !== '$' && <span className="text-lg">{unit}</span>}
        </span>
      </div>

      <div className="mt-2 flex flex-col items-center">

        {descriptionText ? (
          <span className="text-xs text-gray-500 mt-1">
            {descriptionText}
          </span>
        ) : (
          !displayTime && <span className="invisible text-xs mt-1">placeholder</span>
        )}
      </div>
    </div>
  );
};