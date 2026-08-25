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

/** Normalizes a blank string to undefined — same reasoning as order/
 *  interface/http/schemas.ts's own blankToUndefined (an untouched "leave
 *  blank to keep current key" field submits as '', which must mean
 *  "unchanged", not a validation failure). */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);
}

// `provider` isn't accepted from the request at all — only 'openai' is
// wired to anything (see ai.prisma's AiSettings doc comment), so it's set
// server-side in the route handler rather than parsed from user input that
// could only ever validly be one value.
export const updateAiSettingsSchema = z.object({
  apiKey: blankToUndefined(z.string().min(1).max(512).optional()),
  model: z.string().min(1).max(100),
  isActive: z.boolean(),
});

export const assistantChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(50),
});

export const listForecastsQuerySchema = z.object({
  riskTier: z.enum(['high', 'medium', 'low']).optional(),
  websiteId: z.string().regex(/^\d+$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
