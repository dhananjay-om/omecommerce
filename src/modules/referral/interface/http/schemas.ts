import { z } from 'zod';

const rewardTypeSchema = z.enum(['STORE_CREDIT', 'POINTS']);

export const createReferralProgramSchema = z.object({
  websiteCode: z.string().min(1),
  name: z.string().min(1).max(255),
  qualifyingEvent: z.enum(['SIGNUP', 'FIRST_ORDER']).optional(),
  minOrderAmount: z.string().min(1).optional(),
  referrerRewardType: rewardTypeSchema,
  referrerRewardAmount: z.string().min(1).optional(),
  referrerRewardPoints: z.string().regex(/^\d+$/, 'expected a non-negative integer').optional(),
  refereeRewardType: rewardTypeSchema,
  refereeRewardAmount: z.string().min(1).optional(),
  refereeRewardPoints: z.string().regex(/^\d+$/, 'expected a non-negative integer').optional(),
  maxReferralsPerCustomer: z.number().int().positive().optional(),
  attributionWindowDays: z.number().int().positive().optional(),
});

export const attachReferralSchema = z.object({
  code: z.string().min(1).max(32),
});
