import { DashboardPage } from './pages/DashboardPage';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <div className='w-full min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300'>
        <DashboardPage />
      </div>
    </ThemeProvider>
  );
}

export default App;