import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import sk from './locales/sk.json';

// Supported languages for SaaS version (EN + SK only)
export const SUPPORTED_LANGUAGES = ['en-US', 'sk'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Detect OS/browser language
const getDefaultLanguage = (): string => {
  // Check if language is already saved
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage as SupportedLanguage)) {
    return savedLanguage;
  }

  // Get browser/OS language
  const browserLanguage = navigator.language || navigator.languages?.[0] || 'en-US';

  // Map browser language codes to our supported languages
  const languageMap: { [key: string]: string } = {
    'en': 'en-US',
    'en-US': 'en-US',
    'en-GB': 'en-US',
    'sk': 'sk',
    'sk-SK': 'sk',
  };

  // Try exact match first
  if (languageMap[browserLanguage]) {
    return languageMap[browserLanguage];
  }

  // Try language code without region (e.g., 'en' from 'en-AU')
  const baseLanguage = browserLanguage.split('-')[0];
  if (languageMap[baseLanguage]) {
    return languageMap[baseLanguage];
  }

  // Default to English if language not supported
  return 'en-US';
};

const detectedLanguage = getDefaultLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': {
        translation: enUS
      },
      sk: {
        translation: sk
      }
    },
    lng: detectedLanguage,
    fallbackLng: 'en-US',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18n;
