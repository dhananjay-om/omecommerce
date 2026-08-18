import { z } from 'zod';
import { LoyaltyProgramStatus } from '@prisma/client';

export const createLoyaltyProgramSchema = z.object({
  websiteCode: z.string().min(1),
  name: z.string().min(1).max(255),
  pointsPerCurrencyUnit: z.string().min(1),
  pointValue: z.string().min(1),
  redeemMinPoints: z.number().int().nonnegative().optional(),
  pointsExpiryMonths: z.number().int().positive().nullish(),
});

export const updateLoyaltyProgramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  pointsPerCurrencyUnit: z.string().min(1).optional(),
  pointValue: z.string().min(1).optional(),
  redeemMinPoints: z.number().int().nonnegative().optional(),
  pointsExpiryMonths: z.number().int().positive().nullish(),
  status: z.nativeEnum(LoyaltyProgramStatus).optional(),
});

export const createLoyaltyTierSchema = z.object({
  name: z.string().min(1).max(255),
  thresholdPoints: z.string().regex(/^\d+$/, 'expected a non-negative integer'),
  earnMultiplier: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateLoyaltyTierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  thresholdPoints: z.string().regex(/^\d+$/, 'expected a non-negative integer').optional(),
  earnMultiplier: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const adjustLoyaltyAccountSchema = z.object({
  points: z.string().regex(/^-?\d+$/, 'expected an integer'),
  reason: z.string().min(1).max(1000),
});

export const redeemLoyaltyPointsSchema = z.object({
  points: z.string().regex(/^\d+$/, 'expected a non-negative integer'),
});

/** Matches CMS's identical cmsStoreViewQuerySchema — every public store-scoped read resolves by storeViewId. */
export const loyaltyStoreViewQuerySchema = z.object({
  storeViewId: z.string().regex(/^\d+$/, 'storeViewId query param required'),
});
