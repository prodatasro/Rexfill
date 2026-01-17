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
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
        <img
          src={isDarkMode ? '/logo-dark.svg' : '/logo-light.svg'}
          alt="Rexfill"
          className="h-8 sm:h-10 cursor-pointer"
          onClick={onLogoClick}
        />

        <div className="flex items-center gap-2 sm:gap-4">
          <GlobalSearch
            allTemplates={allTemplates}
            folderTree={folderTree}
            onSelectTemplate={handleSelectTemplate}
            onSelectFolder={handleSelectFolder}
          />

          <LanguageSelector />
          
          <button
            onClick={handleToggleTheme}
            className="p-1.5 sm:p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            aria-label={t('header.toggleTheme')}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button
            onClick={logout}
            className="btn-primary text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2"
          >
            {t('header.logout')}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;