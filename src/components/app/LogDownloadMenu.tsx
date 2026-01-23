import { FC, useState, useRef, useEffect } from 'react';
import { FileText, Download, Zap, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LogDownloadMenuProps {
  onDownloadAllLogs: () => void;
  onDownloadOneTimeLogs: () => void;
  isDownloading: boolean;
}

const LogDownloadMenu: FC<LogDownloadMenuProps> = ({
  onDownloadAllLogs,
  onDownloadOneTimeLogs,
  isDownloading,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDownloadAll = () => {
    setIsOpen(false);
    onDownloadAllLogs();
  };

  const handleDownloadOneTime = () => {
    setIsOpen(false);
    onDownloadOneTimeLogs();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDownloading}
        className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors disabled:opacity-50 flex items-center gap-0.5"
        title={t('logs.downloadLogs')}
        aria-label={t('logs.downloadLogs')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <FileText className="w-5 h-5" />
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleDownloadAll}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <div>
                <div className="font-medium">{t('logs.downloadAllLogs')}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('logs.downloadAllLogsDesc')}</div>
              </div>
            </button>
            <button
              onClick={handleDownloadOneTime}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <div>
                <div className="font-medium">{t('logs.downloadOneTimeLogs')}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('logs.downloadOneTimeLogsDesc')}</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogDownloadMenu;
