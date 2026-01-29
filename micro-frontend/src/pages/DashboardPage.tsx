import React, { useState } from "react";
import { MultiPaneChart } from "../components/Chart/MultiPaneChart";
import { MarketHeartbeat } from "../components/MarketHeartbeat";
import { VolatilitySqueeze } from "../components/VolatilitySqueeze";
import { RsiHeatmap } from "../components/RsiHeatmap";
import { OnChainMetrics } from "../components/OnChainMetrics";
import type { Interval } from "../types/OhlcData";
import { useIndicatorsData } from "../hooks/useIndicatorsData";
import { NewsCard, MetricCard, CorrelationMatrix } from "../components";
import { ThemeToggle } from "../components/ThemeToggle";
import { useOhlcData } from "../hooks/useOhlcData";
import { useLatestNews } from "../hooks/useLatestNews";
import {
	useRsiHeatmap,
	useVolatilitySqueeze,
	useMarketHeartbeat,
	useOnChainMetrics,
	useCorrelationMatrix,
} from "../hooks/useAnalytics";
import { Home, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";
import { useMetricChange } from "../hooks/useMetricChange";

const supportedIntervals: { label: string; value: Interval }[] = [
	{ label: "15m", value: "15m" },
	{ label: "1h", value: "1h" },
	{ label: "1d", value: "1d" },
];

const chartTabs = [
	{ id: "btc", label: "BTC", active: true },
	{ id: "eth", label: "ETH", active: false },
	{ id: "sol", label: "SOL", active: false },
];

interface DashboardPageProps {
	onNavigate: (page: "dashboard" | "indicators") => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
	const [activeTab, setActiveTab] = useState("btc");
	const [selectedAsset, setSelectedAsset] = useState("bitcoin");
	const [interval, setInterval] = useState<Interval>(supportedIntervals[2].value);

	const { news, loading: _loadingNews } = useLatestNews();
	const { indicators, isLoading: _indicatorsLoading, error: _indicatorsError } = useIndicatorsData();

	// New analytics hooks
	const { data: rsiData, isLoading: rsiLoading } = useRsiHeatmap();
	const { data: volatilityData, isLoading: volatilityLoading } = useVolatilitySqueeze(selectedAsset);
	const { data: heartbeatData, isLoading: heartbeatLoading } = useMarketHeartbeat();
	const { data: onChainData, isLoading: onChainLoading } = useOnChainMetrics();
	const { data: correlationData, isLoading: correlationLoading } = useCorrelationMatrix();
	const { data: vixChange } = useMetricChange("vix_level");
	const { data: spyChange } = useMetricChange("spy_price");

	const tabToAssetMap: Record<string, string> = {
		btc: "bitcoin",
		eth: "ethereum",
		sol: "solana",
	};

	const { data: chartData, loading: _chartLoading, error: _chartError } = useOhlcData(selectedAsset, interval);

	const getFearGreedLabel = (value: number): string => {
		if (value <= 25) return "Extreme Fear";
		if (value <= 45) return "Fear";
		if (value <= 55) return "Neutral";
		if (value <= 75) return "Greed";
		return "Extreme Greed";
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
			{/* Market Heartbeat Header */}
			<MarketHeartbeat
				btcPrice={heartbeatData.btcPrice}
				ethPrice={heartbeatData.ethPrice}
				solPrice={heartbeatData.solPrice}
				btcDominance={heartbeatData.btcDominance}
				ethGas={heartbeatData.ethGas}
				totalMarketCap={heartbeatData.totalMarketCap}
				fear_greed={
					heartbeatData.fearGreed ||
					(indicators.fearGreedIndex
						? {
								value: indicators.fearGreedIndex.value,
								label: getFearGreedLabel(indicators.fearGreedIndex.value),
							}
						: undefined)
				}
				isLoading={heartbeatLoading}
			/>

			{/* Header */}
			<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-300">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
							<Home className="w-4 h-4" />
							Dashboard
						</button>
						<button
							onClick={() => onNavigate("indicators")}
							className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
						>
							<BarChart3 className="w-4 h-4" />
							Indicators
						</button>
					</div>
					<div>
						<h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
							Financial Insights Dashboard
						</h1>
						<p className="text-sm text-gray-600 dark:text-gray-400 mt-1 transition-colors duration-300">
							Real-time market data and sentiment analysis
						</p>
					</div>
					<ThemeToggle />
				</div>
			</div>

			<div className="p-6 space-y-8">
				{/* Chart Section */}
				<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
					<div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">
								Multi-Pane Technical Analysis
							</h2>

							<div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 transition-colors duration-300">
								{chartTabs.map((tab) => (
									<button
										value={selectedAsset}
										key={tab.id}
										onClick={() => {
											setActiveTab(tab.id);
											setSelectedAsset(tabToAssetMap[tab.id]);
										}}
										className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
											activeTab === tab.id
												? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
												: "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
										}`}
									>
										{tab.label}
									</button>
								))}
							</div>
						</div>
					</div>

					{/* Time Interval Picker */}
					<div className="py-3 border-white dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-300">
						<div className="flex items-center justify-center">
							<div className="flex bg-white dark:bg-gray-700 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-600 transition-colors duration-300">
								{supportedIntervals.map((intervalOption) => (
									<button
										key={intervalOption.value}
										onClick={() => setInterval(intervalOption.value)}
										className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-300 ${
											interval === intervalOption.value
												? "bg-blue-500 dark:bg-blue-600 text-white shadow-sm"
												: "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600"
										}`}
									>
										{intervalOption.label}
									</button>
								))}
							</div>
						</div>
					</div>

					{/* Multi-Pane Chart */}
					<div className="p-6">
						<MultiPaneChart key={`${selectedAsset}-${interval}`} priceData={chartData} showBollingerBands={true} />
					</div>
				</div>

				{/* Analytics Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Volatility Squeeze */}
					<div className="lg:col-span-1">
						<VolatilitySqueeze data={volatilityData} isLoading={volatilityLoading} />
					</div>

					{/* RSI Heatmap */}
					<div className="lg:col-span-2">
						<RsiHeatmap data={rsiData} isLoading={rsiLoading} />
					</div>
				</div>

				{/* Correlation Matrix */}
				<CorrelationMatrix data={correlationData} isLoading={correlationLoading} />

				{/* Macro Indicators */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<MetricCard
						label="VIX"
						value={indicators.vixLevel?.value ?? null}
						unit=""
						precision={2}
						changePercent={vixChange?.change ?? null}
						description="CBOE Volatility Index"
						icon={AlertTriangle}
					/>
					<MetricCard
						label="SPY"
						value={indicators.spyPrice?.value ?? null}
						unit="$"
						precision={2}
						changePercent={spyChange?.change ?? null}
						description="S&P 500 ETF"
						icon={TrendingUp}
					/>
				</div>

				{/* On-Chain Metrics */}
				<OnChainMetrics data={onChainData} isLoading={onChainLoading} />

				{/* News Section */}
				<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
					<div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">
								Latest Market News
							</h2>
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
						{news.map((newsItem, index) => (
							<div
								key={index}
								className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30 shadow-sm"
							>
								<NewsCard
									title={newsItem.title}
									source={newsItem.source}
									time={new Date(newsItem.published_at).toLocaleString()}
									sentiment={newsItem.sentiment}
									url={newsItem.url}
									summary={newsItem.summary}
									imageUrl={newsItem.image_url}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};
