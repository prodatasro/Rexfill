import { FC, useState, useRef, useEffect } from 'react';
import { Sun, Moon, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSearch } from '../../contexts/SearchContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../ui/LanguageSelector';
import { GlobalSearch } from '../ui/GlobalSearch';

interface HeaderProps {
  onLogoClick?: () => void | Promise<void>;
}

const Header: FC<HeaderProps> = ({ onLogoClick }) => {
  const { logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { allTemplates, folderTree, onSelectTemplate, onSelectFolder } = useSearch();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggleTheme = () => {
    toggleTheme();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleProfileClick = () => {
    setShowUserMenu(false);
    navigate('/app/profile');
  };

  const handleLogoutClick = () => {
    setShowUserMenu(false);
    logout();
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

            {/* User menu dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label={t('header.userMenu')}
              >
                <User className="w-5 h-5" />
                <ChevronDown className="w-4 h-4" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                  <button
                    onClick={handleProfileClick}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <User size={16} />
                    {t('header.profile')}
                  </button>
                  <hr className="my-1 border-slate-200 dark:border-slate-700" />
                  <button
                    onClick={handleLogoutClick}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {t('header.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;