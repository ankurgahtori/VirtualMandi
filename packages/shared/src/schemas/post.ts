import { z } from 'zod';
import { POST_SOURCES, POST_STATUSES, POST_TYPES } from '../constants/post.js';

const isoDate = z.string().datetime({ offset: true });
const url = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'URL must use http or https',
  });

export const postTypeSchema = z.enum(POST_TYPES);
export const postSourceSchema = z.enum(POST_SOURCES);
export const postStatusSchema = z.enum(POST_STATUSES);

export const translationSchema = z.object({
  locale: z.string().trim().min(2).max(20),
  title: z.string().trim().min(1).max(240),
  content: z.string().trim().min(1).max(100_000),
});

export const blogPostCreateSchema = z.object({
  type: z.literal('BLOG_POST'),
  source: postSourceSchema,
  externalRedirectUrl: url.optional(),
  imageMediaId: z.string().trim().min(1).max(200).optional(),
  categoryIds: z.array(z.string().trim().min(1)).max(50),
  locationIds: z.array(z.string().trim().min(1)).max(50),
  translations: z.array(translationSchema).min(1).max(20),
});

export const blogPostUpdateSchema = blogPostCreateSchema
  .omit({ type: true, translations: true })
  .partial()
  .extend({ translations: z.array(translationSchema).min(1).max(20).optional() });

export const postListQuerySchema = z.object({
  status: postStatusSchema.optional(),
  type: postTypeSchema.optional(),
  source: postSourceSchema.optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  locationId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const publishableBlogPostSchema = blogPostCreateSchema.superRefine((value, context) => {
  const hasEnglish = value.translations.some((translation) => {
    const locale = translation.locale.toLowerCase();
    return locale === 'en' || locale === 'en-in';
  });

  if (!hasEnglish) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['translations'],
      message: 'An English translation is required before publishing',
    });
  }
});

export const postSummarySchema = z.object({
  id: z.string().min(1),
  type: postTypeSchema,
  status: postStatusSchema,
  createdAt: isoDate,
  updatedAt: isoDate.optional(),
  publishedAt: isoDate.optional(),
  categoryIds: z.array(z.string()),
  locationIds: z.array(z.string()),
});

export const blogPostDetailSchema = postSummarySchema.extend({
  type: z.literal('BLOG_POST'),
  title: z.string().min(1),
  content: z.string().min(1),
  image: z.unknown().optional(),
  externalRedirectUrl: url.optional(),
  source: postSourceSchema,
  requestedLocale: z.string().min(2),
  resolvedLocale: z.string().min(2),
  isEnglishFallback: z.boolean(),
});
