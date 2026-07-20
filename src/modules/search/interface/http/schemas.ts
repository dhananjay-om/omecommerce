import { z } from 'zod';

export const searchQuerySchema = z.object({
  storeViewId: z.string().regex(/^\d+$/, 'expected numeric id'),
  q: z.string().optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'name_asc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
});
