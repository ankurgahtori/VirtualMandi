import {
  normalizeLocale,
  normalizedBlogPostInputSchema,
  type NormalizedBlogPostInput,
} from '@virtual-mandi/shared';

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const sanitizeText = (value: string) =>
  collapseWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  );

const normalizeUrl = (value: string | undefined) => {
  if (!value) return undefined;
  const url = new URL(value.trim());
  url.hash = '';
  return url.toString();
};

export const normalizeBlogPostInput = (input: unknown): NormalizedBlogPostInput => {
  const parsed = normalizedBlogPostInputSchema.parse(input);
  const translations = parsed.translations.map((translation) => {
    const locale = normalizeLocale(translation.locale);
    if (!locale) throw new Error(`Unsupported locale: ${translation.locale}`);
    return {
      locale,
      title: sanitizeText(translation.title),
      content: sanitizeText(translation.content),
    };
  });

  const uniqueTranslations = new Map(
    translations.map((translation) => [translation.locale, translation]),
  );
  if (!uniqueTranslations.has('en-IN')) throw new Error('An English translation is required');

  return {
    ...parsed,
    sourceItemId: parsed.sourceItemId?.trim(),
    canonicalUrl: normalizeUrl(parsed.canonicalUrl),
    imageUrl: normalizeUrl(parsed.imageUrl),
    externalRedirectUrl: normalizeUrl(parsed.externalRedirectUrl),
    translations: [...uniqueTranslations.values()],
    categoryKeys: [...new Set(parsed.categoryKeys.map((key) => key.trim().toLowerCase()))],
    locationKeys: [...new Set(parsed.locationKeys.map((key) => key.trim().toLowerCase()))],
  };
};
