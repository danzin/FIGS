import React from "react";
import { AlertTriangle, TrendingUp, Minus } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

export interface VolatilityState {
	status: "squeeze" | "expanding" | "neutral";
	bandWidth: number;
	bandWidthPercentile: number; // 0-100, where value is compared to historical
	upperBand: number;
	lowerBand: number;
	currentPrice: number;
}

interface VolatilitySqueezeProps {
	data: VolatilityState | null;
	isLoading?: boolean;
}

const getStatusConfig = (status: VolatilityState["status"]) => {
	switch (status) {
		case "squeeze":
			return {
				color: "red",
				bgColor: "bg-red-500",
				textColor: "text-red-500",
				borderColor: "border-red-500",
				lightBg: "bg-red-50 dark:bg-red-900/20",
				label: "Squeeze Detected",
				description: "Low volatility - Prepare for a big move",
				icon: AlertTriangle,
			};
		case "expanding":
			return {
				color: "green",
				bgColor: "bg-green-500",
				textColor: "text-green-500",
				borderColor: "border-green-500",
				lightBg: "bg-green-50 dark:bg-green-900/20",
				label: "Volatility Expanding",
				description: "Market is trending - Follow momentum",
				icon: TrendingUp,
			};
		default:
			return {
				color: "yellow",
				bgColor: "bg-yellow-500",
				textColor: "text-yellow-500",
				borderColor: "border-yellow-500",
				lightBg: "bg-yellow-50 dark:bg-yellow-900/20",
				label: "Neutral",
				description: "Normal volatility conditions",
				icon: Minus,
			};
	}
};

export const VolatilitySqueeze: React.FC<VolatilitySqueezeProps> = ({ data, isLoading = false }) => {
	useTheme(); // Theme context for potential future use

	if (isLoading) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
				<div className="animate-pulse">
					<div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
					<div className="flex items-center gap-4">
						<div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700" />
						<div className="flex-1">
							<div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
							<div className="h-2 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Volatility Squeeze</h3>
				<p className="text-xs text-gray-500 dark:text-gray-400">Insufficient data for analysis</p>
			</div>
		);
	}

	const config = getStatusConfig(data.status);
	const StatusIcon = config.icon;

	// Calculate price position within bands (0-100)
	const pricePosition = ((data.currentPrice - data.lowerBand) / (data.upperBand - data.lowerBand)) * 100;

	return (
		<div
			className={`rounded-xl p-4 shadow-sm border transition-all duration-300 ${config.lightBg} ${config.borderColor}`}
		>
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-white">Volatility Squeeze</h3>
				<div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bgColor} bg-opacity-20`}>
					<div
						className={`w-2 h-2 rounded-full ${config.bgColor} ${data.status === "squeeze" ? "animate-pulse" : ""}`}
					/>
					<span className={`text-xs font-semibold ${config.textColor}`}>{config.label}</span>
				</div>
			</div>

			<div className="flex items-center gap-4">
				{/* Traffic Light Indicator */}
				<div className="relative">
					<div
						className={`w-16 h-16 rounded-full flex items-center justify-center ${config.lightBg} border-4 ${config.borderColor}`}
					>
						<StatusIcon className={`w-8 h-8 ${config.textColor}`} />
					</div>
					{data.status === "squeeze" && (
						<div className={`absolute inset-0 rounded-full ${config.bgColor} opacity-20 animate-ping`} />
					)}
				</div>

				{/* Info */}
				<div className="flex-1">
					<p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{config.description}</p>

					{/* Band Width Percentile Bar */}
					<div className="mb-2">
						<div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
							<span>Band Width</span>
							<span>{data.bandWidthPercentile.toFixed(0)}th percentile</span>
						</div>
						<div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
							<div
								className={`h-full rounded-full transition-all duration-500 ${config.bgColor}`}
								style={{ width: `${data.bandWidthPercentile}%` }}
							/>
						</div>
					</div>

					{/* Price Position within Bands */}
					<div>
						<div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
							<span>Lower: ${data.lowerBand.toFixed(0)}</span>
							<span>Upper: ${data.upperBand.toFixed(0)}</span>
						</div>
						<div className="relative h-2 bg-gradient-to-r from-red-400 via-gray-300 to-green-400 rounded-full">
							<div
								className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-gray-800 rounded-full shadow-md transition-all duration-300"
								style={{ left: `calc(${Math.min(100, Math.max(0, pricePosition))}% - 6px)` }}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
