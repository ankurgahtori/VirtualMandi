export const SUPPORTED_LOCALES = ['en-IN', 'hi-IN'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en-IN';
export const ENGLISH_LOCALE: SupportedLocale = 'en-IN';
export const IST_TIME_ZONE = 'Asia/Kolkata';

export const localeAliases: Record<string, SupportedLocale> = {
  en: 'en-IN',
  'en-in': 'en-IN',
  hi: 'hi-IN',
  'hi-in': 'hi-IN',
};

export const normalizeLocale = (locale: string): SupportedLocale | undefined => {
  const normalized = locale.trim().toLowerCase();
  return (
    localeAliases[normalized] ??
    SUPPORTED_LOCALES.find((supported) => supported.toLowerCase() === normalized)
  );
};
