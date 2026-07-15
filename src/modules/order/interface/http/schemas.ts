import { z } from 'zod';

export const createCartSchema = z.object({
  storeViewId: z.string().regex(/^\d+$/, 'expected numeric id'),
  customerGroupCode: z.string().min(1).nullish(),
});

export const addCartLineSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().positive(),
});

const addressSchema = z.object({
  name: z.string().min(1),
  company: z.string().nullish(),
  line1: z.string().min(1),
  line2: z.string().nullish(),
  city: z.string().min(1),
  region: z.string().nullish(),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  phone: z.string().nullish(),
});

export const completeCheckoutSchema = z.object({
  email: z.string().email(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  shippingMethodCode: z.string().min(1),
  paymentMethod: z.string().min(1),
  testScenario: z.enum(['approve', 'decline']).optional(),
});

export const fulfillOrderSchema = z.object({
  lines: z.array(z.object({ sku: z.string().min(1), qty: z.number().int().positive() })).min(1),
});

export const refundOrderSchema = z.object({
  lines: z.array(z.object({ sku: z.string().min(1), qty: z.number().int().positive() })).min(1),
  restock: z.boolean().optional(),
});

export const createTaxClassSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  rate: z.string().regex(/^0\.\d{1,4}$|^0$/, 'expected a fraction like "0.0825"'),
});

export const createShippingMethodSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  flatRate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'expected a decimal amount'),
  currency: z.string().length(3),
});
