import { z } from 'zod';
import { postSourceSchema } from './post.js';

const safeUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'URL must use http or https',
  });

const ingestionTranslationSchema = z.object({
  locale: z.string().trim().min(2).max(20),
  title: z.string().trim().min(1).max(240),
  content: z.string().trim().min(1).max(100_000),
});

export const normalizedBlogPostInputSchema = z
  .object({
    source: postSourceSchema,
    sourceItemId: z.string().trim().min(1).max(500).optional(),
    canonicalUrl: safeUrl.optional(),
    translations: z.array(ingestionTranslationSchema).min(1).max(20),
    imageUrl: safeUrl.optional(),
    imageFixtureKey: z.string().trim().min(1).max(500).optional(),
    externalRedirectUrl: safeUrl.optional(),
    summary: z.string().trim().min(1).max(2000).optional(),
    categoryKeys: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    locationKeys: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    discoveredAt: z.string().datetime({ offset: true }).optional(),
    fetchedAt: z.string().datetime({ offset: true }).optional(),
    crawlerName: z.string().trim().max(100).optional(),
    crawlerVersion: z.string().trim().max(50).optional(),
    initialStatus: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  })
  .refine((value) => value.sourceItemId || value.canonicalUrl, {
    message: 'sourceItemId or canonicalUrl is required for stable identity',
    path: ['sourceItemId'],
  });

export type NormalizedBlogPostInput = z.infer<typeof normalizedBlogPostInputSchema>;

export const syncRequestSchema = z
  .object({
    pages: z.number().int().min(1).max(10).optional(),
    after: z.string().datetime({ offset: true }).optional(),
    update: z.boolean().optional(),
  })
  .default({});

export type SyncRequestInput = z.infer<typeof syncRequestSchema>;
