import en from './en.json';
import hi from './hi.json';
import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  normalizeLocale,
  type SupportedLocale,
} from '../constants/locales.js';

type TranslationTree = typeof en;
export type TranslationKey = `${keyof TranslationTree & string}.${string}`;

const resources: Record<SupportedLocale, TranslationTree> = {
  'en-IN': en,
  'hi-IN': hi,
};

const getNestedValue = (resource: TranslationTree, key: string): string | undefined => {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, resource);
  return typeof value === 'string' ? value : undefined;
};

export const getMessage = (locale: string, key: string): string => {
  const normalized = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  return (
    getNestedValue(resources[normalized], key) ??
    getNestedValue(resources[ENGLISH_LOCALE], key) ??
    key
  );
};

export const getMessages = (locale: string): TranslationTree => {
  const normalized = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  return resources[normalized];
};
