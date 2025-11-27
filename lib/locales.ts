export const LOCALES = {
  en: { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English', 
    flag: '🇬🇧' 
  },
  ru: { 
    code: 'ru', 
    name: 'Russian', 
    nativeName: 'Русский', 
    flag: '🇷🇺' 
  },
  de: { 
    code: 'de', 
    name: 'German', 
    nativeName: 'Deutsch', 
    flag: '🇩🇪' 
  },
  es: { 
    code: 'es', 
    name: 'Spanish', 
    nativeName: 'Español', 
    flag: '🇪🇸' 
  },
  fr: { 
    code: 'fr', 
    name: 'French', 
    nativeName: 'Français', 
    flag: '🇫🇷' 
  },
  it: { 
    code: 'it', 
    name: 'Italian', 
    nativeName: 'Italiano', 
    flag: '🇮🇹' 
  },
  pt: { 
    code: 'pt', 
    name: 'Portuguese', 
    nativeName: 'Português', 
    flag: '🇵🇹' 
  },
  zh: { 
    code: 'zh', 
    name: 'Chinese', 
    nativeName: '中文', 
    flag: '🇨🇳' 
  },
  ja: { 
    code: 'ja', 
    name: 'Japanese', 
    nativeName: '日本語', 
    flag: '🇯🇵' 
  },
  ko: { 
    code: 'ko', 
    name: 'Korean', 
    nativeName: '한국어', 
    flag: '🇰🇷' 
  },
  pl: { 
    code: 'pl', 
    name: 'Polish', 
    nativeName: 'Polski', 
    flag: '🇵🇱' 
  },
} as const;

export const DEFAULT_LOCALE = 'en';

export type LocaleCode = keyof typeof LOCALES;

export type LocaleInfo = typeof LOCALES[LocaleCode];

// Хелпер для получения информации о языке
export const getLocaleInfo = (code: string): LocaleInfo | undefined => {
  return LOCALES[code as LocaleCode];
};

// Массив всех кодов языков
export const ALL_LOCALE_CODES = Object.keys(LOCALES) as LocaleCode[];

