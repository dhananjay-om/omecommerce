import { z } from 'zod';
import { PriceListType } from '@prisma/client';

export const createCustomerGroupSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  isDefault: z.boolean().optional(),
});

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'expected a decimal amount, e.g. "19.99"');

export const createPriceListSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  currency: z.string().length(3),
  type: z.nativeEnum(PriceListType).optional(),
  priority: z.number().int().optional(),
  customerGroupCode: z.string().min(1).nullish(),
  websiteCode: z.string().min(1).nullish(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
});

export const updatePriceListSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  currency: z.string().length(3).optional(),
  type: z.nativeEnum(PriceListType).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const setProductPriceSchema = z.object({
  variantId: z.string().uuid(),
  price: decimalString,
});

export const setPriceTierSchema = z.object({
  variantId: z.string().uuid(),
  minQty: z.number().int().positive(),
  price: decimalString,
});

export const resolvePriceQuerySchema = z.object({
  variantId: z.string().uuid(),
  qty: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  customerGroupCode: z.string().min(1).optional(),
  websiteCode: z.string().min(1).optional(),
});
