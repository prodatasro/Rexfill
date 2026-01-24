import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Globe } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useTheme } from '../../contexts/ThemeContext';

export const AccountSettings: FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t('profile.nav.settings')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {t('profile.settings.subtitle')}
        </p>
      </div>

      {/* Theme Settings */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">
          {t('profile.settings.theme.title')}
        </h3>
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <div className="flex items-center gap-3">
            {isDarkMode ? (
              <Moon size={20} className="text-slate-600 dark:text-slate-400" />
            ) : (
              <Sun size={20} className="text-slate-600 dark:text-slate-400" />
            )}
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-50">
                {isDarkMode ? t('profile.settings.theme.dark') : t('profile.settings.theme.light')}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('profile.settings.theme.description')}
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              isDarkMode ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                isDarkMode ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Language Settings */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">
          {t('profile.settings.language.title')}
        </h3>
        <div className="space-y-2">
          {[
            { code: 'en-US', label: 'English' },
            { code: 'sk', label: 'Slovenčina' },
          ].map(({ code, label }) => (
            <button
              key={code}
              onClick={() => handleLanguageChange(code)}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                i18n.language === code
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-slate-600 dark:text-slate-400" />
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {label}
                </span>
              </div>
              {i18n.language === code && (
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Session Info */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">
          {t('profile.sessionInfo')}
        </h3>
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('profile.principalId')}
          </p>
          <p className="text-sm text-slate-900 dark:text-slate-50 font-mono bg-white dark:bg-slate-800 p-3 rounded-lg break-all">
            {user?.key || t('profile.notSet')}
          </p>
        </div>
      </div>
    </div>
  );
};
