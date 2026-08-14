import { z } from 'zod';
import { CouponDiscountType, CouponTargetType, CouponConditionType } from '@prisma/client';

const decimalString = z.string().regex(/^\d+(\.\d{1,4})?$/, 'expected a decimal amount, e.g. "19.99"');

const couponConditionSchema = z
  .object({
    conditionType: z.nativeEnum(CouponConditionType),
    productId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    attributeCode: z.string().min(1).optional(),
    attributeValue: z.string().min(1).optional(),
  })
  .refine((c) => c.conditionType !== 'PRODUCT' || !!c.productId, { message: 'productId required for PRODUCT conditions' })
  .refine((c) => c.conditionType !== 'CATEGORY' || !!c.categoryId, { message: 'categoryId required for CATEGORY conditions' })
  .refine((c) => c.conditionType !== 'ATTRIBUTE' || (!!c.attributeCode && !!c.attributeValue), {
    message: 'attributeCode and attributeValue required for ATTRIBUTE conditions',
  });

export const createCouponSchema = z.object({
  code: z.string().min(1).max(64),
  description: z.string().max(1024).optional(),
  discountType: z.nativeEnum(CouponDiscountType),
  value: decimalString,
  currency: z.string().length(3).nullish(),
  minSubtotal: decimalString.nullish(),
  targetType: z.nativeEnum(CouponTargetType).optional(),
  isAutoApply: z.boolean().optional(),
  conditions: z.array(couponConditionSchema).optional(),
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
  targetType: z.nativeEnum(CouponTargetType).optional(),
  isAutoApply: z.boolean().optional(),
  conditions: z.array(couponConditionSchema).optional(),
  usageLimit: z.number().int().positive().nullish(),
  usageLimitPerCustomer: z.number().int().positive().nullish(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  isActive: z.boolean().optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1).max(64),
});
