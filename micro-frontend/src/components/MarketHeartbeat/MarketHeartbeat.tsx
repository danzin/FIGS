import React from "react";
import { TrendingUp, TrendingDown, Minus, Fuel, Crown, Activity, Zap } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

interface MarketHeartbeatProps {
	btcDominance?: { value: number; change: number | null };
	ethGas?: { value: number; status: "low" | "medium" | "high" };
	totalMarketCap?: { value: number; change: number | null };
	btcPrice?: { value: number; change: number | null };
	ethPrice?: { value: number; change: number | null };
	solPrice?: { value: number; change: number | null };
	fear_greed?: { value: number; label: string };
	isLoading?: boolean;
}

const formatLargeNumber = (num: number): string => {
	if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
	if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
	if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
	if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
	return num.toFixed(2);
};

const getGasStatus = (gwei: number): { status: "low" | "medium" | "high"; label: string; color: string } => {
	if (gwei <= 15) return { status: "low", label: "Low", color: "text-green-500" };
	if (gwei <= 50) return { status: "medium", label: "Medium", color: "text-yellow-500" };
	return { status: "high", label: "High", color: "text-red-500" };
};

const ChangeIndicator: React.FC<{ change: number | null }> = ({ change }) => {
	if (change === null || change === undefined) return <Minus className="w-3 h-3 text-gray-400" />;

	if (change > 0) {
		return (
			<span className="flex items-center text-green-500 text-xs font-medium">
				<TrendingUp className="w-3 h-3 mr-0.5" />
				{change.toFixed(2)}%
			</span>
		);
	}

	return (
		<span className="flex items-center text-red-500 text-xs font-medium">
			<TrendingDown className="w-3 h-3 mr-0.5" />
			{Math.abs(change).toFixed(2)}%
		</span>
	);
};

const MetricPill: React.FC<{
	label: string;
	value: string;
	change?: number | null;
	subtext?: string;
	icon: React.ReactNode;
	highlight?: boolean;
}> = ({ label, value, change, subtext, icon, highlight }) => {
	const { theme } = useTheme();
	const isDark = theme === "dark";

	return (
		<div
			className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 flex-shrink-0 ${
				highlight
					? "bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20"
					: isDark
						? "bg-gray-800/50 hover:bg-gray-800"
						: "bg-gray-100/50 hover:bg-gray-100"
			}`}
		>
			<div className={`${highlight ? "text-purple-500" : "text-gray-500 dark:text-gray-400"} flex-shrink-0`}>{icon}</div>
			<div className="flex flex-col min-w-0">
				<span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
					{label}
				</span>
				<div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
					<span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">{value}</span>
					{change !== undefined && <ChangeIndicator change={change} />}
					{subtext && <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">({subtext})</span>}
				</div>
			</div>
		</div>
	);
};

export const MarketHeartbeat: React.FC<MarketHeartbeatProps> = ({
	btcDominance,
	ethGas,
	totalMarketCap,
	btcPrice,
	ethPrice,
	solPrice,
	fear_greed,
	isLoading = false,
}) => {
	const { theme } = useTheme();
	const isDark = theme === "dark";

	if (isLoading) {
		return (
			<div className="flex items-center gap-4 px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
				{Array(5)
					.fill(0)
					.map((_, i) => (
						<div key={i} className="animate-pulse flex items-center gap-2 px-3 py-2">
							<div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
							<div className="flex flex-col gap-1">
								<div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded" />
								<div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
							</div>
						</div>
					))}
			</div>
		);
	}

	const gasInfo = ethGas ? getGasStatus(ethGas.value) : null;

	return (
		<div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 px-2 sm:px-4 md:px-6 py-2 sm:py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto transition-colors duration-300 scrollbar-thin">
			{/* Live indicator */}
			<div className="flex items-center gap-1 sm:gap-1.5 pr-2 sm:pr-3 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div className="relative flex h-2 w-2">
					<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
					<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
				</div>
				<span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">LIVE</span>
			</div>

			{/* BTC Price */}
			{btcPrice && (
				<MetricPill
					label="BTC"
					value={`$${formatLargeNumber(btcPrice.value)}`}
					change={btcPrice.change}
					icon={<Activity className="w-3 h-3 sm:w-4 sm:h-4" />}
					highlight
				/>
			)}

			{/* ETH Price */}
			{ethPrice && (
				<MetricPill
					label="ETH"
					value={`$${formatLargeNumber(ethPrice.value)}`}
					change={ethPrice.change}
					icon={<Zap className="w-3 h-3 sm:w-4 sm:h-4" />}
				/>
			)}

			{/* SOL Price */}
			{solPrice && (
				<MetricPill
					label="SOL"
					value={`$${formatLargeNumber(solPrice.value)}`}
					change={solPrice.change}
					icon={<Activity className="w-3 h-3 sm:w-4 sm:h-4" />}
				/>
			)}

			{/* BTC Dominance */}
			{btcDominance && (
				<MetricPill
					label="BTC Dom"
					value={`${btcDominance.value.toFixed(1)}%`}
					change={btcDominance.change}
					icon={<Crown className="w-3 h-3 sm:w-4 sm:h-4" />}
				/>
			)}

			{/* ETH Gas */}
			{ethGas && gasInfo && (
				<div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex-shrink-0 ${isDark ? "bg-gray-800/50" : "bg-gray-100/50"}`}>
					<Fuel className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 ${gasInfo.color}`} />
					<div className="flex flex-col min-w-0">
						<span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
							ETH Gas
						</span>
						<div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
							<span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">{ethGas.value} gwei</span>
						<span className={`text-[10px] sm:text-xs font-medium ${gasInfo.color} whitespace-nowrap`}>({gasInfo.label})</span>
					</div>
				</div>
			</div>
		)}

		{/* Total Market Cap */}
		{totalMarketCap && (
			<MetricPill
				label="Total MCap"
				value={`$${formatLargeNumber(totalMarketCap.value)}`}
				change={totalMarketCap.change}
				icon={<TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />}
			/>
		)}

		{/* Fear & Greed Index */}
		{fear_greed && (
			<div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex-shrink-0 ${isDark ? "bg-gray-800/50" : "bg-gray-100/50"}`}>
				<div
					className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0 ${
						fear_greed.value <= 25
							? "bg-red-500"
							: fear_greed.value <= 45
								? "bg-orange-500"
								: fear_greed.value <= 55
									? "bg-yellow-500"
									: fear_greed.value <= 75
										? "bg-lime-500"
										: "bg-green-500"
					}`}
				/>
				<div className="flex flex-col min-w-0">
					<span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
						Fear & Greed
					</span>
					<div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
						<span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">{fear_greed.value}</span>
						<span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">({fear_greed.label})</span>
					</div>
				</div>
			</div>
		)}
	</div>
	);
};
