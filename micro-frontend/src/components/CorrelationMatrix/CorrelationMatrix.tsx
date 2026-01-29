import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

export interface CorrelationData {
	assets: string[];
	matrix: number[][];
}

interface CorrelationMatrixProps {
	data: CorrelationData;
	isLoading?: boolean;
}

// Get color based on correlation value (-1 to 1)
const getCorrelationColor = (value: number, isDark: boolean): string => {
	if (value === null || isNaN(value)) return isDark ? "#374151" : "#f3f4f6";

	// Clamp value between -1 and 1
	const clamped = Math.max(-1, Math.min(1, value));

	if (clamped >= 0) {
		// Positive correlation: white -> dark green
		const intensity = Math.floor(clamped * 255);
		return `rgb(${255 - intensity}, ${255}, ${255 - intensity})`;
	} else {
		// Negative correlation: white -> dark red
		const intensity = Math.floor(Math.abs(clamped) * 255);
		return `rgb(${255}, ${255 - intensity}, ${255 - intensity})`;
	}
};

const getTextColor = (value: number): string => {
	if (Math.abs(value) > 0.6) return "#ffffff";
	return "#374151";
};

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ data, isLoading = false }) => {
	const { theme } = useTheme();
	const isDark = theme === "dark";

	if (isLoading) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Asset Correlation Matrix</h3>
				<div className="animate-pulse">
					<div className="grid grid-cols-5 gap-1">
						{Array(25)
							.fill(0)
							.map((_, i) => (
								<div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
							))}
					</div>
				</div>
			</div>
		);
	}

	const { assets, matrix } = data;

	if (!assets || assets.length === 0) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Asset Correlation Matrix</h3>
				<p className="text-gray-500 dark:text-gray-400 text-sm">No correlation data available</p>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asset Correlation Matrix</h3>
					<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">30-day Pearson correlation • Updated hourly</p>
				</div>
				<div className="flex items-center gap-2 text-xs">
					<div className="flex items-center gap-1">
						<div className="w-3 h-3 rounded" style={{ backgroundColor: "rgb(0, 255, 0)" }} />
						<span className="text-gray-600 dark:text-gray-300">+1</span>
					</div>
					<div className="flex items-center gap-1">
						<div className="w-3 h-3 rounded bg-white border border-gray-300" />
						<span className="text-gray-600 dark:text-gray-300">0</span>
					</div>
					<div className="flex items-center gap-1">
						<div className="w-3 h-3 rounded" style={{ backgroundColor: "rgb(255, 0, 0)" }} />
						<span className="text-gray-600 dark:text-gray-300">-1</span>
					</div>
				</div>
			</div>

			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr>
							<th className="w-16" />
							{assets.map((asset) => (
								<th
									key={asset}
									className="px-2 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 text-center"
								>
									{asset}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{assets.map((rowAsset, rowIndex) => (
							<tr key={rowAsset}>
								<td className="px-2 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 text-right">
									{rowAsset}
								</td>
								{assets.map((colAsset, colIndex) => {
									const value = matrix[rowIndex]?.[colIndex] ?? 0;
									const bgColor = getCorrelationColor(value, isDark);
									const textColor = getTextColor(value);

									return (
										<td key={colAsset} className="p-1">
											<div
												className="flex items-center justify-center h-12 rounded-lg text-xs font-mono font-semibold transition-all duration-200 hover:scale-105 cursor-default"
												style={{
													backgroundColor: bgColor,
													color: textColor,
												}}
												title={`${rowAsset} vs ${colAsset}: ${value.toFixed(3)}`}
											>
												{value.toFixed(2)}
											</div>
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Interpretation helper */}
			<div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
				<p className="text-xs text-gray-600 dark:text-gray-300">
					<span className="font-semibold">Reading:</span> Values close to{" "}
					<span className="text-green-600 dark:text-green-400 font-mono">+1</span> indicate assets move together.{" "}
					<span className="text-red-600 dark:text-red-400 font-mono">-1</span> means inverse movement.{" "}
					<span className="font-mono">0</span> suggests no correlation.
				</p>
			</div>
		</div>
	);
};
