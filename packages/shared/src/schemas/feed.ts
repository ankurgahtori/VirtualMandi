import { z } from 'zod';

export const feedQuerySchema = z.object({
  locale: z.string().trim().min(2).max(20).default('en-IN'),
  locationId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
