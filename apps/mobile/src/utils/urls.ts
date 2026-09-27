import { mobileConfig } from '../config/env';

/**
 * Media DTOs may carry a root-relative path ("/v1/media/…") when no public
 * storage base URL is configured on the API. Resolve those against the same
 * API base URL the app already uses so images load on any device/network.
 */
export const resolveMediaUrl = (value: string | undefined) => {
  if (!value) return undefined;
  if (value.startsWith('/')) return `${mobileConfig.apiBaseUrl}${value}`;
  return value;
};

export const safeExternalUrl = (value: string | undefined) => {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
};
