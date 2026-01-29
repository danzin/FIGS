import React from "react";
import type { CompositeIndicatorData } from "../../types/AdvancedIndicators";
import { Target, TrendingUp, Activity, Cpu, Droplets, Gauge } from "lucide-react";

interface CompositeIndicatorProps {
	data: CompositeIndicatorData | null;
	isLoading: boolean;
}

export const CompositeIndicator: React.FC<CompositeIndicatorProps> = ({ data, isLoading }) => {
	const getScoreColor = (score: number) => {
		if (score >= 70) return "text-green-500";
		if (score >= 50) return "text-yellow-500";
		if (score >= 30) return "text-orange-500";
		return "text-red-500";
	};

	const getRegimeColor = (regime: string) => {
		switch (regime) {
			case "bull":
				return "text-green-500 bg-green-500/10 border-green-500/30";
			case "bear":
				return "text-red-500 bg-red-500/10 border-red-500/30";
			default:
				return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
		}
	};

	const getScoreBarColor = (score: number) => {
		if (score >= 70) return "bg-green-500";
		if (score >= 50) return "bg-yellow-500";
		if (score >= 30) return "bg-orange-500";
		return "bg-red-500";
	};

	const componentIcons: Record<string, React.ReactNode> = {
		rsi: <Activity className="w-4 h-4 text-blue-500" />,
		mvrv: <Target className="w-4 h-4 text-purple-500" />,
		minerHealth: <Cpu className="w-4 h-4 text-cyan-500" />,
		liquidityFlow: <Droplets className="w-4 h-4 text-indigo-500" />,
		momentum: <Gauge className="w-4 h-4 text-amber-500" />,
	};

	const componentLabels: Record<string, string> = {
		rsi: "RSI (20%)",
		mvrv: "MVRV Z-Score (25%)",
		minerHealth: "Miner Health (20%)",
		liquidityFlow: "Liquidity Flow (20%)",
		momentum: "Momentum (15%)",
	};

	if (isLoading) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
				<div className="animate-pulse">
					<div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
					<div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
			<div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Composite Market Score</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Weighted blend of all indicators</p>
					</div>
					<Target className="w-6 h-6 text-green-500" />
				</div>
			</div>

			<div className="p-6">
				{/* Main Score Display */}
				<div className="flex items-center justify-center mb-8">
					<div className="relative">
						{/* Circular progress background */}
						<svg className="w-40 h-40 transform -rotate-90">
							<circle
								cx="80"
								cy="80"
								r="70"
								stroke="currentColor"
								strokeWidth="8"
								fill="transparent"
								className="text-gray-200 dark:text-gray-700"
							/>
							<circle
								cx="80"
								cy="80"
								r="70"
								stroke="currentColor"
								strokeWidth="8"
								fill="transparent"
								strokeDasharray={`${(data?.overallScore ?? 0) * 4.4} 440`}
								strokeLinecap="round"
								className={getScoreColor(data?.overallScore ?? 0)}
							/>
						</svg>
						{/* Score text */}
						<div className="absolute inset-0 flex flex-col items-center justify-center">
							<span className={`text-4xl font-bold ${getScoreColor(data?.overallScore ?? 0)}`}>
								{data?.overallScore}
							</span>
							<span className="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
						</div>
					</div>
				</div>

				{/* Regime Badge */}
				<div className="flex justify-center mb-6">
					<span
						className={`px-6 py-2 rounded-full text-lg font-semibold border ${getRegimeColor(
							data?.regime ?? "neutral"
						)}`}
					>
						{(data?.regime ?? "neutral").toUpperCase()} REGIME
					</span>
				</div>

				{/* Recommendation */}
				<div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
					<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
						<TrendingUp className="w-4 h-4" />
						Recommendation
					</h4>
					<p className="text-gray-600 dark:text-gray-400">{data?.recommendation}</p>
				</div>

				{/* Component Breakdown */}
				<div className="space-y-4">
					<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Component Scores</h4>
					{data?.normalizedScores &&
						Object.entries(data.normalizedScores).map(([key, score]) => (
							<div key={key} className="space-y-1">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										{componentIcons[key]}
										<span className="text-sm text-gray-600 dark:text-gray-400">{componentLabels[key]}</span>
									</div>
									<span className={`text-sm font-semibold ${getScoreColor(score)}`}>{score}</span>
								</div>
								<div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
									<div
										className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(score)}`}
										style={{ width: `${score}%` }}
									/>
								</div>
							</div>
						))}
				</div>

				{/* Formula */}
				<div className="mt-6 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
					<p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
						Score = (RSI × 0.20) + (MVRV × 0.25) + (Miner × 0.20) + (Liquidity × 0.20) + (Momentum × 0.15)
					</p>
				</div>
			</div>
		</div>
	);
};
