import React from "react";
import { ExternalLink } from "lucide-react";

interface NewsItemProps {
	title: string;
	source: string;
	time: string;
	sentiment: string;
	url?: string;
}

export const NewsItem: React.FC<NewsItemProps> = ({ title, source, time, sentiment, url }) => (
	<div className="flex items-start gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-all duration-300">
		<div
			className={`w-1 h-12 rounded-full transition-colors duration-300 ${
				sentiment === "bullish"
					? "bg-green-400 dark:bg-green-500"
					: sentiment === "bearish"
						? "bg-red-400 dark:bg-red-500"
						: "bg-blue-400 dark:bg-blue-500"
			}`}
		/>
		<div className="flex-1 min-w-0">
			{url ? (
				<a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-1">
					<h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-5 transition-colors duration-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
						{title}
					</h4>
					<ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors" />
				</a>
			) : (
				<h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-5 transition-colors duration-300">
					{title}
				</h4>
			)}
			<div className="flex items-center gap-3 mt-2">
				<span className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">{source}</span>
				<span className="text-xs text-gray-400 dark:text-gray-500 transition-colors duration-300">•</span>
				<span className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">{time}</span>
			</div>
		</div>
		<div
			className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
				sentiment === "bullish"
					? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
					: sentiment === "bearish"
						? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
						: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
			}`}
		>
			{sentiment}
		</div>
	</div>
);
