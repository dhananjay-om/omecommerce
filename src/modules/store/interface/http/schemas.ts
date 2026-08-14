import { z } from 'zod';

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
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'expected a valid 15-character GSTIN')
    .nullish(),
  originStateCode: z.string().regex(/^\d{2}$/, 'expected a 2-digit GST state code, e.g. "27"').nullish(),
  pricesIncludeTax: z.boolean().optional(),
});
