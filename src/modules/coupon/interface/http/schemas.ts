import { z } from 'zod';
import { CouponDiscountType } from '@prisma/client';

const decimalString = z.string().regex(/^\d+(\.\d{1,4})?$/, 'expected a decimal amount, e.g. "19.99"');

export const createCouponSchema = z.object({
  code: z.string().min(1).max(64),
  description: z.string().max(1024).optional(),
  discountType: z.nativeEnum(CouponDiscountType),
  value: decimalString,
  currency: z.string().length(3).nullish(),
  minSubtotal: decimalString.nullish(),
  usageLimit: z.number().int().positive().nullish(),
  usageLimitPerCustomer: z.number().int().positive().nullish(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  isActive: z.boolean().optional(),
});

export const updateCouponSchema = z.object({
  description: z.string().max(1024).nullish(),
  discountType: z.nativeEnum(CouponDiscountType).optional(),
  value: decimalString.optional(),
  currency: z.string().length(3).nullish(),
  minSubtotal: decimalString.nullish(),
  usageLimit: z.number().int().positive().nullish(),
  usageLimitPerCustomer: z.number().int().positive().nullish(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  isActive: z.boolean().optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1).max(64),
});
