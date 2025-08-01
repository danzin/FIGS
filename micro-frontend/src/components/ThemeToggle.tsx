import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 group"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="relative w-5 h-5">
        <Sun 
          className={`absolute inset-0 w-5 h-5 text-yellow-500 transition-all duration-300 transform ${
            theme === 'light' 
              ? 'rotate-0 scale-100 opacity-100' 
              : 'rotate-90 scale-0 opacity-0'
          }`} 
        />
        
        <Moon 
          className={`absolute inset-0 w-5 h-5 text-blue-400 transition-all duration-300 transform ${
            theme === 'dark' 
              ? 'rotate-0 scale-100 opacity-100' 
              : '-rotate-90 scale-0 opacity-0'
          }`} 
        />
      </div>
      
      <div className={`absolute inset-0 rounded-lg transition-all duration-300 ${
        theme === 'light' 
          ? 'bg-yellow-50 dark:bg-yellow-50/5 opacity-0 group-hover:opacity-50' 
          : 'bg-blue-50 dark:bg-blue-50/5 opacity-0 group-hover:opacity-50'
      }`} />
    </button>
  );
};