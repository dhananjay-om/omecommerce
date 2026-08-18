import { z } from 'zod';
import { LoyaltyProgramStatus, ReferralStatus } from '@prisma/client';

const rewardTypeSchema = z.enum(['STORE_CREDIT', 'POINTS']);
const pointsStringSchema = z.string().regex(/^\d+$/, 'expected a non-negative integer');

export const createReferralProgramSchema = z.object({
  websiteCode: z.string().min(1),
  name: z.string().min(1).max(255),
  qualifyingEvent: z.enum(['SIGNUP', 'FIRST_ORDER']).optional(),
  minOrderAmount: z.string().min(1).optional(),
  referrerRewardType: rewardTypeSchema,
  referrerRewardAmount: z.string().min(1).optional(),
  referrerRewardPoints: pointsStringSchema.optional(),
  refereeRewardType: rewardTypeSchema,
  refereeRewardAmount: z.string().min(1).optional(),
  refereeRewardPoints: pointsStringSchema.optional(),
  maxReferralsPerCustomer: z.number().int().positive().optional(),
  attributionWindowDays: z.number().int().positive().optional(),
});

export const updateReferralProgramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.nativeEnum(LoyaltyProgramStatus).optional(),
  qualifyingEvent: z.enum(['SIGNUP', 'FIRST_ORDER']).optional(),
  minOrderAmount: z.string().min(1).nullish(),
  referrerRewardType: rewardTypeSchema.optional(),
  referrerRewardAmount: z.string().min(1).nullish(),
  referrerRewardPoints: pointsStringSchema.nullish(),
  refereeRewardType: rewardTypeSchema.optional(),
  refereeRewardAmount: z.string().min(1).nullish(),
  refereeRewardPoints: pointsStringSchema.nullish(),
  maxReferralsPerCustomer: z.number().int().positive().nullish(),
  attributionWindowDays: z.number().int().positive().nullish(),
});

export const attachReferralSchema = z.object({
  code: z.string().min(1).max(32),
});

export const listReferralsQuerySchema = z.object({
  status: z.nativeEnum(ReferralStatus).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

/** Matches CMS's identical cmsStoreViewQuerySchema — every public store-scoped read resolves by storeViewId. */
export const referralStoreViewQuerySchema = z.object({
  storeViewId: z.string().regex(/^\d+$/, 'storeViewId query param required'),
});
