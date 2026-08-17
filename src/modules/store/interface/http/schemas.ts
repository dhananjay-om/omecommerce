import { z } from 'zod';

/** Normalizes a whitespace-only or blank string to undefined before the real
 *  schema sees it — an untouched optional field can arrive as '' or ' ', which
 *  a format regex would never match, so without this a blank field would be a
 *  hard validation failure instead of "not provided." Own-copy per module,
 *  same convention as this codebase's other tiny per-module helpers. */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);
}

export const createCurrencySchema = z.object({
  code: z.string().trim().length(3),
  symbol: z.string().min(1).max(8),
  name: z.string().min(1).max(64),
  minorUnits: z.number().int().min(0).max(6).optional(),
});

export const updateCurrencySchema = z.object({
  symbol: z.string().min(1).max(8).optional(),
  name: z.string().min(1).max(64).optional(),
  minorUnits: z.number().int().min(0).max(6).optional(),
  isDefault: z.boolean().optional(),
});

export const updateWebsiteTaxSettingsSchema = z.object({
  gstin: blankToUndefined(
    z
      .string()
      .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'expected a valid 15-character GSTIN')
      .nullish(),
  ),
  originStateCode: blankToUndefined(z.string().regex(/^\d{2}$/, 'expected a 2-digit GST state code, e.g. "27"').nullish()),
  pricesIncludeTax: z.boolean().optional(),
  address: blankToUndefined(z.string().max(500).nullish()),
  logoMediaKey: blankToUndefined(z.string().max(500).nullish()),
});

export const requestLogoUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
});
