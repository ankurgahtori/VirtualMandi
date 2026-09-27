import { z } from 'zod';

const safeUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'URL must use http or https',
  });

export const syncSourceCreateSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9.-]+$/i, 'Domain must be a hostname'),
  label: z.string().trim().min(1).max(200),
  adapterKey: z.string().trim().min(1).max(100),
});

export type SyncSourceCreateInput = z.infer<typeof syncSourceCreateSchema>;

export const syncSourceCategoryCreateSchema = z.object({
  syncSourceId: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  listingUrl: safeUrl,
  categoryId: z.string().trim().min(1).max(100).optional(),
  locationId: z.string().trim().min(1).max(100).optional(),
  adapterConfig: z.record(z.unknown()).optional(),
});

export type SyncSourceCategoryCreateInput = z.infer<typeof syncSourceCategoryCreateSchema>;
