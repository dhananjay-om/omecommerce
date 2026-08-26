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

export const listSuggestionsQuerySchema = z.object({
  kind: z.enum(['RESTOCK', 'PROMOTE_SLOW_MOVER', 'FEATURE_TRENDING_CATEGORY']).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  websiteId: z.string().regex(/^\d+$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

// Per-product AI Assistant (product edit page). `context` is whatever the
// admin's own form currently holds — the frontend already has this data
// loaded (product/attributes/categories), so it's passed rather than
// re-fetched, keeping every generation route a pure "context in, draft out"
// call with no extra reads beyond what a given action genuinely needs
// (analyze-performance/suggest-price still fetch real numbers server-side,
// since the Overview page doesn't load those).
const productContextSchema = z.object({
  title: z.string().max(512),
  description: z.string().max(20000).optional(),
  sku: z.string().max(128).optional(),
  productType: z.string().max(64).optional(),
  categoryNames: z.array(z.string().max(256)).max(50).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export const generateFromContextSchema = z.object({
  context: productContextSchema,
});

export const suggestCategorySchema = z.object({
  context: productContextSchema,
  categoryNames: z.array(z.string().max(256)).min(1).max(500),
});

// storageKey/mimeType only, never the image bytes themselves — the backend
// reads the already-uploaded object's own bytes server-side (see
// ProductAssistant.analyzeImage), which avoids bloating this request body
// ~33% for no benefit the way a base64 data URL over JSON would.
export const analyzeProductImageSchema = z.object({
  storageKey: z.string().min(1).max(512),
  mimeType: z.string().regex(/^image\//, 'expected an image mime type'),
  context: productContextSchema,
});
