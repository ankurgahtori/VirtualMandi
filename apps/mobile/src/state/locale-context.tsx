import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { normalizeLocale, type SupportedLocale } from '@virtual-mandi/shared';
import { mobileConfig } from '../config/env';
import { loadFilters, saveFilters } from './filter-state';

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale(locale: SupportedLocale): void;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export const LocaleProvider = ({ children }: PropsWithChildren) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(mobileConfig.defaultLocale);

  useEffect(() => {
    loadFilters().then((filters) =>
      setLocaleState(normalizeLocale(filters.locale) ?? mobileConfig.defaultLocale),
    );
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale);
        loadFilters().then((filters) => saveFilters({ ...filters, locale: nextLocale }));
      },
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
};
