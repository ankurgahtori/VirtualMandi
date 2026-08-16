import { normalizeLocale, type SupportedLocale } from '@virtual-mandi/shared';

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const readMobileConfig = (env: Record<string, string | undefined>) => {
  const rawApiBaseUrl = env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const rawLocale = env.EXPO_PUBLIC_DEFAULT_LOCALE?.trim() ?? 'en-IN';
  if (!rawApiBaseUrl || !isHttpUrl(rawApiBaseUrl)) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL must be a valid http(s) URL. See apps/mobile/ENVIRONMENT.md.',
    );
  }
  return {
    apiBaseUrl: rawApiBaseUrl.replace(/\/$/, ''),
    defaultLocale: normalizeLocale(rawLocale) ?? 'en-IN',
  } satisfies { apiBaseUrl: string; defaultLocale: SupportedLocale };
};

export const mobileConfig = readMobileConfig(process.env);
