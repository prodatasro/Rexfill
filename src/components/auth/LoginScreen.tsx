import { FC } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const LoginScreen: FC = () => {
  const { login } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center relative">
      {/* Theme toggle in top-right corner */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-xl"
        aria-label="Toggle theme"
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>

      <div className="max-w-md w-full mx-4">
        <div className="card p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2 uppercase tracking-wide">
              📄 Rexfill
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              Sign in to manage your Word templates
            </p>
          </div>

          <button
            onClick={login}
            className="w-full btn-primary text-lg py-4"
          >
            🔐 Sign in with Internet Identity
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your templates are stored securely on the Internet Computer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;