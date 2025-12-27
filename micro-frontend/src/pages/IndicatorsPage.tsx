import React from "react";
import {
	PowerLawChart,
	StablecoinLiquidityChart,
	OpenInterestChart,
	MVRVChart,
	MomentumCoalescenceChart,
	HashRateChart,
	CompositeIndicator,
} from "../components/Indicators";
import {
	usePowerLaw,
	useStablecoinLiquidity,
	useOpenInterest,
	useMomentumCoalescence,
	useMVRV,
	useHashRate,
	useCompositeIndicator,
} from "../hooks/useAdvancedIndicators";
import { ThemeToggle } from "../components/ThemeToggle";
import { BarChart3, Home } from "lucide-react";

interface IndicatorsPageProps {
	onNavigate: (page: "dashboard" | "indicators") => void;
}

export const IndicatorsPage: React.FC<IndicatorsPageProps> = ({ onNavigate }) => {
	// Fetch all indicator data
	const { data: powerLawData, isLoading: powerLawLoading } = usePowerLaw();
	const { data: stablecoinData, isLoading: stablecoinLoading } = useStablecoinLiquidity();
	const { data: oiData, isLoading: oiLoading } = useOpenInterest();
	const { data: momentumData, isLoading: momentumLoading } = useMomentumCoalescence();
	const { data: mvrvData, isLoading: mvrvLoading } = useMVRV();
	const { data: hashRateData, isLoading: hashRateLoading } = useHashRate();
	const { data: compositeData, isLoading: compositeLoading } = useCompositeIndicator();

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
			{/* Header */}
			<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-300 sticky top-0 z-50">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<button
							onClick={() => onNavigate("dashboard")}
							className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
						>
							<Home className="w-4 h-4" />
							Dashboard
						</button>
						<button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
							<BarChart3 className="w-4 h-4" />
							Indicators
						</button>
					</div>
					<div className="flex items-center gap-4">
						<div>
							<h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
								Advanced Indicators
							</h1>
							<p className="text-sm text-gray-600 dark:text-gray-400 mt-1 transition-colors duration-300">
								Power Law, Liquidity, Leverage & Momentum Models
							</p>
						</div>
					</div>
					<ThemeToggle />
				</div>
			</div>

			<div className="p-6 space-y-8">
				{/* Composite Score - Full Width at Top */}
				<CompositeIndicator data={compositeData} isLoading={compositeLoading} />

				{/* Section: Long-Term Valuation */}
				<div>
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
						<span className="w-2 h-2 rounded-full bg-blue-500"></span>
						Long-Term Valuation Models
					</h2>
					<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
						<PowerLawChart data={powerLawData} isLoading={powerLawLoading} />
						<MVRVChart data={mvrvData} isLoading={mvrvLoading} />
					</div>
				</div>

				{/* Section: Macro Liquidity */}
				<div>
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
						<span className="w-2 h-2 rounded-full bg-purple-500"></span>
						Macro Liquidity & Cycle Indicators
					</h2>
					<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
						<StablecoinLiquidityChart data={stablecoinData} isLoading={stablecoinLoading} />
						<HashRateChart data={hashRateData} isLoading={hashRateLoading} />
					</div>
				</div>

				{/* Section: Market Structure */}
				<div>
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
						<span className="w-2 h-2 rounded-full bg-amber-500"></span>
						Market Structure & Momentum
					</h2>
					<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
						<OpenInterestChart data={oiData} isLoading={oiLoading} />
						<MomentumCoalescenceChart data={momentumData} isLoading={momentumLoading} />
					</div>
				</div>

				{/* Data Sources Footer */}
				<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Sources & Methodology</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
						<div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
							<h4 className="font-medium text-gray-900 dark:text-white mb-1">Power Law Model</h4>
							<p className="text-gray-500 dark:text-gray-400">
								Logarithmic regression since genesis block. Fair value = 10^(A + B × log(days))
							</p>
						</div>
						<div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
							<h4 className="font-medium text-gray-900 dark:text-white mb-1">Stablecoin Liquidity</h4>
							<p className="text-gray-500 dark:text-gray-400">
								DefiLlama API. USDT + USDC + DAI + FDUSD market caps. YoY growth and 30d momentum.
							</p>
						</div>
						<div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
							<h4 className="font-medium text-gray-900 dark:text-white mb-1">Open Interest</h4>
							<p className="text-gray-500 dark:text-gray-400">
								Aggregate futures OI across exchanges. 30d change signals local tops (&gt;40%) and bottoms (&lt;-15%).
							</p>
						</div>
						<div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
							<h4 className="font-medium text-gray-900 dark:text-white mb-1">MVRV Z-Score</h4>
							<p className="text-gray-500 dark:text-gray-400">
								200-week SMA proxy for Realized Price. Z-Score indicates over/undervaluation.
							</p>
						</div>
						<div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
							<h4 className="font-medium text-gray-900 dark:text-white mb-1">Hash Rate Ribbon</h4>
							<p className="text-gray-500 dark:text-gray-400">
								Blockchain.com API. 30d/60d SMA crossover signals miner capitulation recovery.
							</p>
						</div>
						<div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
							<h4 className="font-medium text-gray-900 dark:text-white mb-1">Momentum Coalescence</h4>
							<p className="text-gray-500 dark:text-gray-400">
								Blend of Fast ROC, Slow ROC, Volume Delta, and Volatility Directional Bias.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
