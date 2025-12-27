import { useState } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { IndicatorsPage } from "./pages/IndicatorsPage";
import { ThemeProvider } from "./contexts/ThemeContext";

type Page = "dashboard" | "indicators";

function App() {
	const [currentPage, setCurrentPage] = useState<Page>("dashboard");

	const handleNavigate = (page: Page) => {
		setCurrentPage(page);
	};

	return (
		<ThemeProvider>
			<div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
				{currentPage === "dashboard" ? (
					<DashboardPage onNavigate={handleNavigate} />
				) : (
					<IndicatorsPage onNavigate={handleNavigate} />
				)}
			</div>
		</ThemeProvider>
	);
}

export default App;
