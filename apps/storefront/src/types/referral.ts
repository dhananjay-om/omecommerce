export type ReferralQualifyingEvent = 'SIGNUP' | 'FIRST_ORDER';
export type ReferralRewardType = 'STORE_CREDIT' | 'POINTS';
export type ReferralStatus = 'SIGNED_UP' | 'QUALIFIED' | 'REWARDED' | 'EXPIRED' | 'REVERSED';
export type ReferralBeneficiary = 'REFERRER' | 'REFEREE';

export interface ReferralReward {
  beneficiary: ReferralBeneficiary;
  rewardType: ReferralRewardType;
  amount: string | null;
  points: string | null;
}

export interface Referral {
  publicId: string;
  status: ReferralStatus;
  createdAt: string;
  qualifiedAt: string | null;
  rewardedAt: string | null;
  referrerReward: ReferralReward | null;
}

export interface MyReferrals {
  code: string;
  referrals: Referral[];
}

export interface AttachReferralResult {
  referralPublicId: string;
  status: ReferralStatus;
  refereeReward: ReferralReward | null;
}

/** Public program terms — GET /store/v1/referral/program. States what the referrer
 *  and the referee each get, so a shopper knows the offer before sharing their link. */
export interface PublicReferralProgram {
  name: string;
  qualifyingEvent: ReferralQualifyingEvent;
  minOrderAmount: string | null;
  referrerRewardType: ReferralRewardType;
  referrerRewardAmount: string | null;
  referrerRewardPoints: string | null;
  refereeRewardType: ReferralRewardType;
  refereeRewardAmount: string | null;
  refereeRewardPoints: string | null;
  maxReferralsPerCustomer: number | null;
}
