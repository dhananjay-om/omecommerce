import { z } from 'zod';

const DATE_ONLY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a date, e.g. "2026-07-01"');

export const listInsightsQuerySchema = z.object({
  category: z.string().optional(),
  impact: z.enum(['high', 'medium', 'low']).optional(),
  dateFrom: DATE_ONLY.optional(),
  dateTo: DATE_ONLY.optional(),
  websiteId: z.string().regex(/^\d+$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
