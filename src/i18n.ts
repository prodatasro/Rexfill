import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import sk from './locales/sk.json';
import cs from './locales/cs.json';
import pl from './locales/pl.json';
import hu from './locales/hu.json';
import de from './locales/de.json';
import es from './locales/es.json';
import it from './locales/it.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';

// Detect OS/browser language
const getDefaultLanguage = (): string => {
  // Check if language is already saved
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage) {
    return savedLanguage;
  }

  // Get browser/OS language
  const browserLanguage = navigator.language || navigator.languages?.[0] || 'sk';
  
  // Map browser language codes to our supported languages
  const languageMap: { [key: string]: string } = {
    'en': 'en-US',
    'en-US': 'en-US',
    'en-GB': 'en-US',
    'sk': 'sk',
    'sk-SK': 'sk',
    'cs': 'cs',
    'cs-CZ': 'cs',
    'pl': 'pl',
    'pl-PL': 'pl',
    'hu': 'hu',
    'hu-HU': 'hu',
    'de': 'de',
    'de-DE': 'de',
    'de-AT': 'de',
    'de-CH': 'de',
    'es': 'es',
    'es-ES': 'es',
    'es-MX': 'es',
    'it': 'it',
    'it-IT': 'it',
    'fr': 'fr',
    'fr-FR': 'fr',
    'fr-CA': 'fr',
    'zh': 'zh',
    'zh-CN': 'zh',
    'zh-TW': 'zh',
    'ja': 'ja',
    'ja-JP': 'ja'
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

  // Default to Slovak if language not supported
  return 'sk';
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
      },
      cs: {
        translation: cs
      },
      pl: {
        translation: pl
      },
      hu: {
        translation: hu
      },
      de: {
        translation: de
      },
      es: {
        translation: es
      },
      it: {
        translation: it
      },
      fr: {
        translation: fr
      },
      zh: {
        translation: zh
      },
      ja: {
        translation: ja
      }
    },
    lng: detectedLanguage,
    fallbackLng: 'sk',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18n;
