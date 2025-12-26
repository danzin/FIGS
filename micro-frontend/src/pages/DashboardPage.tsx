import { useState } from "react";
import { MultiPaneChart } from "../components/Chart/MultiPaneChart";
import { MarketHeartbeat } from "../components/MarketHeartbeat";
import { VolatilitySqueeze } from "../components/VolatilitySqueeze";
import { RsiHeatmap } from "../components/RsiHeatmap";
import { OnChainMetrics } from "../components/OnChainMetrics";
import type { Interval } from "../types/OhlcData";
import { useIndicatorsData } from "../hooks/useIndicatorsData";
import { NewsItem } from "../components";
import { ThemeToggle } from "../components/ThemeToggle";
import { useOhlcData } from "../hooks/useOhlcData";
import { useLatestNews } from "../hooks/useLatestNews";
import { useRsiHeatmap, useVolatilitySqueeze, useMarketHeartbeat, useOnChainMetrics } from "../hooks/useAnalytics";

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

export const DashboardPage = () => {
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

	const tabToAssetMap: Record<string, string> = {
		btc: "bitcoin",
		eth: "ethereum",
		sol: "solana",
	};

	const { data: chartData, loading: _chartLoading, error: _chartError } = useOhlcData(selectedAsset, interval);

	// Get fear/greed label
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

					<div className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors duration-300">
						{news.map((newsItem, index) => (
							<NewsItem
								key={index}
								title={newsItem.title}
								source={newsItem.source}
								time={new Date(newsItem.published_at).toLocaleString()}
								sentiment={newsItem.sentiment}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};
