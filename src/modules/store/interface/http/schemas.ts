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
});
