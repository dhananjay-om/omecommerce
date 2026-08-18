import type { LoyaltyTxnType, LoyaltySource, LoyaltyProgramStatus, WalletStatus } from '@prisma/client';

export interface CreateLoyaltyProgramCommand {
  websiteCode: string;
  name: string;
  pointsPerCurrencyUnit: string;
  pointValue: string;
  redeemMinPoints?: number;
  pointsExpiryMonths?: number | null;
}

export interface UpdateLoyaltyProgramCommand {
  name?: string;
  pointsPerCurrencyUnit?: string;
  pointValue?: string;
  redeemMinPoints?: number;
  pointsExpiryMonths?: number | null;
  status?: LoyaltyProgramStatus;
}

export interface LoyaltyProgramView {
  publicId: string;
  websiteCode: string;
  name: string;
  status: LoyaltyProgramStatus;
  pointsPerCurrencyUnit: string;
  pointValue: string;
  redeemMinPoints: number;
  pointsExpiryMonths: number | null;
}

export interface CreateLoyaltyTierCommand {
  programPublicId: string;
  name: string;
  thresholdPoints: string;
  earnMultiplier?: string;
  sortOrder?: number;
}

export interface UpdateLoyaltyTierCommand {
  name?: string;
  thresholdPoints?: string;
  earnMultiplier?: string;
  sortOrder?: number;
}

export interface LoyaltyTierView {
  id: string;
  name: string;
  thresholdPoints: string;
  earnMultiplier: string;
  sortOrder: number;
}

export interface LoyaltyAccountView {
  publicId: string;
  pointsBalance: string;
  lifetimePoints: string;
  tier: LoyaltyTierView | null;
  status: WalletStatus;
}

export interface LoyaltyTransactionView {
  type: LoyaltyTxnType;
  points: string;
  balanceAfter: string;
  source: LoyaltySource;
  reason: string | null;
  createdAt: string;
}

export interface AdjustLoyaltyAccountCommand {
  customerPublicId: string;
  points: string;
  reason: string;
}

export interface RedeemLoyaltyPointsResult {
  redeemedPoints: string;
  storeCreditAmount: string;
  walletBalance: string;
}

export interface PublicLoyaltyTierView {
  name: string;
  thresholdPoints: string;
  earnMultiplier: string;
  sortOrder: number;
}

/** Public, unauthenticated read for the storefront rewards page (plan/15
 *  Phase 4) — deliberately excludes websiteCode/status/publicId, which
 *  a shopper has no use for; a program that isn't ACTIVE is treated as
 *  not existing (see get-public-loyalty-program.usecase.ts). */
export interface PublicLoyaltyProgramView {
  name: string;
  pointsPerCurrencyUnit: string;
  pointValue: string;
  redeemMinPoints: number;
  pointsExpiryMonths: number | null;
  tiers: PublicLoyaltyTierView[];
}
