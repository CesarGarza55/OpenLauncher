import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';

const I18nContext = createContext(null);

const translations = { en, es, fr };

// IPC helper (safe for browser dev mode)
const launcher = window?.launcher ?? {};
const getAppLanguage = typeof launcher.getAppLanguage === 'function'
  ? launcher.getAppLanguage.bind(launcher)
  : () => Promise.resolve('en');
const setAppLanguage = typeof launcher.setAppLanguage === 'function'
  ? launcher.setAppLanguage.bind(launcher)
  : () => Promise.resolve();

const LANGUAGE_STORAGE_KEY = 'openlauncher.language';

function readStoredLanguage() {
  try {
    const storedLanguage = window?.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    return storedLanguage && translations[storedLanguage] ? storedLanguage : null;
  } catch {
    return null;
  }
}

function writeStoredLanguage(language) {
  try {
    if (window?.localStorage) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  } catch {
    // Ignore storage failures and fall back to IPC persistence.
  }
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    let mounted = true;
    
    const loadLanguage = async () => {
      try {
        const storedLanguage = readStoredLanguage();
        if (storedLanguage) {
          if (mounted) {
            setLanguageState(storedLanguage);
          }
          return;
        }

        const savedLanguage = await getAppLanguage();
        if (mounted && savedLanguage && translations[savedLanguage]) {
          setLanguageState(savedLanguage);
          writeStoredLanguage(savedLanguage);
        }
      } catch (error) {
        console.warn('Failed to load saved language:', error);
      } finally {
        if (mounted) {
          setIsLoaded(true);
        }
      }
    };

    loadLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (newLanguage) => {
    if (!translations[newLanguage]) {
      console.warn(`Translation for "${newLanguage}" not found`);
      return;
    }

    setLanguageState(newLanguage);
    writeStoredLanguage(newLanguage);
    
    try {
      await setAppLanguage(newLanguage);
    } catch (error) {
      console.warn('Failed to save language preference:', error);
    }
  }, []);

  const t = useCallback((key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    if (typeof value !== 'string') {
      // Fallback to English
      let fallbackValue = translations.en;
      for (const k of keys) {
        if (fallbackValue && typeof fallbackValue === 'object') {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue || key;
    }

    // Replace parameters
    if (params && typeof params === 'object') {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    return value;
  }, [language]);

  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}