import type { WalletStatus } from './wallet';

export type LoyaltyTxnType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST' | 'REVERSE';
export type LoyaltySource = 'ORDER' | 'ADMIN' | 'CUSTOMER' | 'EXPIRE' | 'REVERSAL' | 'REFERRAL';

export interface LoyaltyTier {
  id: string;
  name: string;
  thresholdPoints: string;
  earnMultiplier: string;
  sortOrder: number;
}

export interface LoyaltyAccount {
  publicId: string;
  pointsBalance: string;
  lifetimePoints: string;
  tier: LoyaltyTier | null;
  status: WalletStatus;
}

export interface LoyaltyTransaction {
  type: LoyaltyTxnType;
  points: string;
  balanceAfter: string;
  source: LoyaltySource;
  reason: string | null;
  createdAt: string;
}

export interface RedeemLoyaltyPointsResult {
  redeemedPoints: string;
  storeCreditAmount: string;
  walletBalance: string;
}

/** Public program terms — GET /store/v1/loyalty/program. No account data (points
 *  balance/tier come from LoyaltyAccount above, which is customer-scoped). */
export interface PublicLoyaltyProgram {
  name: string;
  pointsPerCurrencyUnit: string;
  pointValue: string;
  redeemMinPoints: number;
  pointsExpiryMonths: number | null;
  tiers: Array<Omit<LoyaltyTier, 'id'>>;
}
