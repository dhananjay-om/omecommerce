import type { ReferralQualifyingEvent, ReferralRewardType, ReferralStatus, ReferralBeneficiary, LoyaltyProgramStatus } from '@prisma/client';

export interface CreateReferralProgramCommand {
  websiteCode: string;
  name: string;
  qualifyingEvent?: ReferralQualifyingEvent;
  minOrderAmount?: string;
  referrerRewardType: ReferralRewardType;
  referrerRewardAmount?: string;
  referrerRewardPoints?: string;
  refereeRewardType: ReferralRewardType;
  refereeRewardAmount?: string;
  refereeRewardPoints?: string;
  maxReferralsPerCustomer?: number;
  attributionWindowDays?: number;
}

export interface UpdateReferralProgramCommand {
  name?: string;
  status?: LoyaltyProgramStatus;
  qualifyingEvent?: ReferralQualifyingEvent;
  minOrderAmount?: string | null;
  referrerRewardType?: ReferralRewardType;
  referrerRewardAmount?: string | null;
  referrerRewardPoints?: string | null;
  refereeRewardType?: ReferralRewardType;
  refereeRewardAmount?: string | null;
  refereeRewardPoints?: string | null;
  maxReferralsPerCustomer?: number | null;
  attributionWindowDays?: number | null;
}

export interface ReferralProgramView {
  publicId: string;
  websiteCode: string;
  name: string;
  status: LoyaltyProgramStatus;
  qualifyingEvent: ReferralQualifyingEvent;
  minOrderAmount: string | null;
  referrerRewardType: ReferralRewardType;
  referrerRewardAmount: string | null;
  referrerRewardPoints: string | null;
  refereeRewardType: ReferralRewardType;
  refereeRewardAmount: string | null;
  refereeRewardPoints: string | null;
  maxReferralsPerCustomer: number | null;
  attributionWindowDays: number | null;
}

export interface ReferralRewardView {
  beneficiary: ReferralBeneficiary;
  rewardType: ReferralRewardType;
  amount: string | null;
  points: string | null;
}

/** status REVERSED means the referrer's reward (referrerReward) was clawed back — ReferralReward rows are immutable, so this is the only place that fact is visible, not a flag on the reward itself. */
export interface ReferralView {
  publicId: string;
  status: ReferralStatus;
  createdAt: string;
  qualifiedAt: string | null;
  rewardedAt: string | null;
  referrerReward: ReferralRewardView | null;
}

export interface MyReferralsView {
  code: string;
  referrals: ReferralView[];
}

export interface AttachReferralCommand {
  code: string;
}

export interface AttachReferralResult {
  referralPublicId: string;
  status: ReferralStatus;
  refereeReward: ReferralRewardView | null;
}

export interface ListReferralsQuery {
  status?: ReferralStatus;
  page?: number;
  pageSize?: number;
}

export interface AdminReferralListItemView {
  publicId: string;
  referrerEmail: string;
  refereeEmail: string;
  status: ReferralStatus;
  createdAt: string;
  qualifiedAt: string | null;
  rewardedAt: string | null;
  referrerReward: ReferralRewardView | null;
  refereeReward: ReferralRewardView | null;
}

export interface AdminReferralListView {
  total: number;
  page: number;
  pageSize: number;
  referrals: AdminReferralListItemView[];
}
