import { FC } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSearch } from '../contexts/SearchContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import { GlobalSearch } from './ui/GlobalSearch';

interface HeaderProps {
  onLogoClick?: () => void | Promise<void>;
}

const Header: FC<HeaderProps> = ({ onLogoClick }) => {
  const { logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const { allTemplates, folderTree, onSelectTemplate, onSelectFolder } = useSearch();

  const handleToggleTheme = () => {
    toggleTheme();
  };

  // Fallback handlers if callbacks are not set
  const handleSelectTemplate = onSelectTemplate || (() => {});
  const handleSelectFolder = onSelectFolder || (() => {});

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <img
            src={isDarkMode ? '/logo-dark.svg' : '/logo-light.svg'}
            alt="Rexfill"
            className="h-8 sm:h-9 cursor-pointer"
            onClick={onLogoClick}
          />

          <div className="flex items-center gap-2 sm:gap-3">
            <GlobalSearch
              allTemplates={allTemplates}
              folderTree={folderTree}
              onSelectTemplate={handleSelectTemplate}
              onSelectFolder={handleSelectFolder}
            />

            <LanguageSelector />

            <button
              onClick={handleToggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label={t('header.toggleTheme')}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={logout}
              className="btn-primary text-sm px-4 py-2"
            >
              {t('header.logout')}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;