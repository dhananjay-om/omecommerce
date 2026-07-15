import { z } from 'zod';

export const createLoyaltyProgramSchema = z.object({
  websiteCode: z.string().min(1),
  name: z.string().min(1).max(255),
  pointsPerCurrencyUnit: z.string().min(1),
  pointValue: z.string().min(1),
  redeemMinPoints: z.number().int().nonnegative().optional(),
  pointsExpiryMonths: z.number().int().positive().nullish(),
});

export const createLoyaltyTierSchema = z.object({
  name: z.string().min(1).max(255),
  thresholdPoints: z.string().regex(/^\d+$/, 'expected a non-negative integer'),
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
