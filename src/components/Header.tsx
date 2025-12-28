import { FC } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Header: FC = () => {
  const { logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  console.log('Header - isDarkMode:', isDarkMode); // Debug log

  const handleToggleTheme = () => {
    console.log('Theme button clicked'); // Debug log
    toggleTheme();
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide">
          📄 Rexfill
        </h1>
        
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleTheme}
            className="p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            aria-label="Toggle theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          <button
            onClick={logout}
            className="btn-primary"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;