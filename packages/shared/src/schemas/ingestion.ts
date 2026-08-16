import { z } from 'zod';
import { postSourceSchema } from './post.js';

export const normalizedBlogPostInputSchema = z.object({
  source: postSourceSchema,
  sourceItemId: z.string().trim().min(1).max(500),
  canonicalUrl: z.string().url().optional(),
  translations: z
    .array(
      z.object({
        locale: z.string().trim().min(2).max(20),
        title: z.string().trim().min(1).max(240),
        content: z.string().trim().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(20),
  imageUrl: z.string().url().optional(),
  externalRedirectUrl: z.string().url().optional(),
  categoryKeys: z.array(z.string().trim().min(1)).max(50).default([]),
  locationKeys: z.array(z.string().trim().min(1)).max(50).default([]),
  fetchedAt: z.string().datetime({ offset: true }).optional(),
  crawlerName: z.string().trim().max(100).optional(),
  crawlerVersion: z.string().trim().max(50).optional(),
  initialStatus: z.literal('DRAFT').default('DRAFT'),
});

export type NormalizedBlogPostInput = z.infer<typeof normalizedBlogPostInputSchema>;
