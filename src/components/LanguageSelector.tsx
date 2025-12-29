import { FC, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'sk', countryCode: 'sk' },
  { code: 'en-US', countryCode: 'us' },
  { code: 'cs', countryCode: 'cz' },
  { code: 'pl', countryCode: 'pl' },
  { code: 'hu', countryCode: 'hu' },
  { code: 'de', countryCode: 'de' },
  { code: 'es', countryCode: 'es' },
  { code: 'it', countryCode: 'it' },
  { code: 'fr', countryCode: 'fr' },
  { code: 'zh', countryCode: 'cn' },
  { code: 'ja', countryCode: 'jp' }
];

const FlagIcon: FC<{ countryCode: string }> = ({ countryCode }) => (
  <img 
    src={`https://flagcdn.com/24x18/${countryCode}.png`}
    srcSet={`https://flagcdn.com/48x36/${countryCode}.png 2x, https://flagcdn.com/72x54/${countryCode}.png 3x`}
    width="24"
    height="18"
    alt={`${countryCode} flag`}
    className="inline-block"
  />
);

const LanguageSelector: FC = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 px-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
        aria-label="Select language"
      >
        <FlagIcon countryCode={currentLanguage.countryCode} />
        <span className="hidden sm:inline">{t(`language.${currentLanguage.code}`)}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 ${
                lang.code === i18n.language
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <FlagIcon countryCode={lang.countryCode} />
              <span>{t(`language.${lang.code}`)}</span>
              {lang.code === i18n.language && (
                <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
