import React from 'react';
import type { IndicatorData } from '../types/OhlcData';

interface MetricCardProps {
  label: string;
  indicator?: IndicatorData; 
  unit?: string;  
  precision?: number; 
  description?: string;
  gradient?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  indicator,
  unit = '',
  precision = 2,
  description: descriptionProp,
  gradient = '',
}) => {
  const displayValue = indicator?.value !== undefined ? indicator.value.toFixed(precision) : '--';
  const displayTime = indicator?.timestamp ? new Date(indicator.timestamp).toLocaleTimeString() : '';
  let descriptionText: string | undefined = descriptionProp;
  if (indicator?.name === 'fear_greed_index' && indicator.value !== undefined) {
    switch (true) {
      case indicator.value < 20:
      descriptionText = 'Extreme Fear';
      break;
    case indicator.value < 40:
      descriptionText = 'Fear';
      break;
    case indicator.value < 60:
      descriptionText = 'Neutral';
      break;
    case indicator.value < 80:
      descriptionText = 'Greed';
      break;
    case indicator.value <= 100:
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
          {unit === '$' && <span className="text-2xl">{unit}</span>}
          {displayValue}
          {unit !== '$' && <span className="text-2xl">{unit}</span>}
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