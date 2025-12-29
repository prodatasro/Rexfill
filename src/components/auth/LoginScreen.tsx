import { FC } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../LanguageSelector';

const LoginScreen: FC = () => {
  const { login } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center relative">
      {/* Language and theme toggles in top-right corner */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <LanguageSelector />
        
        <button
          onClick={toggleTheme}
          className="p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          aria-label={t('header.toggleTheme')}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="max-w-md w-full mx-4">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src={isDarkMode ? '/logo-dark.svg' : '/logo-light.svg'} 
                alt="Rexfill" 
                className="h-16"
              />
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              {t('login.subtitle')}
            </p>
          </div>

          <button
            onClick={login}
            className="w-full btn-primary text-lg py-4"
          >
            🔐 {t('login.signIn')}
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('login.secureNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;