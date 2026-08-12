import type { LoyaltyProgramStatus, ReferralQualifyingEvent, ReferralRewardType, ReferralStatus, ReferralBeneficiary } from '@prisma/client';

export interface CustomerContext {
  customerId: bigint;
  websiteId: bigint;
  currency: string;
}

/** Read-only cross-module lookup: a customer's own website + that website's base currency (own trivial copy, matching Wallet/Loyalty's identical-purpose lookup). Both directions are needed: storefront use-cases start from a publicId, the worker starts from an internal customerId (via Order). */
export interface CustomerContextLookup {
  resolveByPublicId(customerPublicId: string): Promise<CustomerContext | null>;
  resolveByCustomerId(customerId: bigint): Promise<CustomerContext | null>;
}

export interface OrderContext {
  id: bigint;
  publicId: string;
  customerId: bigint | null;
  websiteId: bigint;
  grandTotal: string;
}

/** Read-only cross-module lookup: own trivial copy, used only by the worker (not Order module's repository). */
export interface OrderLookup {
  byPublicId(orderPublicId: string): Promise<OrderContext | null>;
}

export interface LoyaltyProgramRef {
  id: bigint;
}

/** Read-only cross-module lookup: own trivial copy of "does a Loyalty program exist for this website" — used both to validate a POINTS-typed reward program at creation time and to resolve which account to credit at issuance time. Not Loyalty module's own repository. */
export interface LoyaltyProgramLookup {
  findByWebsiteId(websiteId: bigint): Promise<LoyaltyProgramRef | null>;
}

export interface ReferralProgramInfo {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  name: string;
  status: LoyaltyProgramStatus;
  qualifyingEvent: ReferralQualifyingEvent;
  minOrderAmount: string | null;
  referrerRewardType: ReferralRewardType;
  referrerRewardAmount: string | null;
  referrerRewardPoints: bigint | null;
  refereeRewardType: ReferralRewardType;
  refereeRewardAmount: string | null;
  refereeRewardPoints: bigint | null;
  maxReferralsPerCustomer: number | null;
  attributionWindowDays: number | null;
}

export interface CreateReferralProgramInput {
  websiteId: bigint;
  name: string;
  qualifyingEvent?: ReferralQualifyingEvent;
  minOrderAmount?: string | null;
  referrerRewardType: ReferralRewardType;
  referrerRewardAmount?: string | null;
  referrerRewardPoints?: bigint | null;
  refereeRewardType: ReferralRewardType;
  refereeRewardAmount?: string | null;
  refereeRewardPoints?: bigint | null;
  maxReferralsPerCustomer?: number | null;
  attributionWindowDays?: number | null;
  createdBy?: bigint;
}

export interface ReferralProgramRepository {
  create(input: CreateReferralProgramInput): Promise<ReferralProgramInfo>;
  findById(id: bigint): Promise<ReferralProgramInfo | null>;
  findByWebsiteId(websiteId: bigint): Promise<ReferralProgramInfo | null>;
}

export interface ReferralCodeInfo {
  id: bigint;
  publicId: string;
  programId: bigint;
  customerId: bigint;
  code: string;
  usesCount: number;
}

export interface ReferralCodeRepository {
  findByCustomerAndProgram(customerId: bigint, programId: bigint): Promise<ReferralCodeInfo | null>;
  /** Generates a fresh code and inserts it, retrying internally on the rare collision against the DB unique constraint. */
  create(programId: bigint, customerId: bigint): Promise<ReferralCodeInfo>;
  findByCode(code: string): Promise<ReferralCodeInfo | null>;
  incrementUses(id: bigint): Promise<void>;
}

export interface ReferralInfo {
  id: bigint;
  publicId: string;
  programId: bigint;
  referralCodeId: bigint;
  referrerCustomerId: bigint;
  refereeCustomerId: bigint;
  status: ReferralStatus;
  qualifyingOrderId: bigint | null;
  createdAt: Date;
  qualifiedAt: Date | null;
  rewardedAt: Date | null;
}

export interface CreateReferralInput {
  programId: bigint;
  referralCodeId: bigint;
  referrerCustomerId: bigint;
  refereeCustomerId: bigint;
}

/**
 * Referral relationships. Unlike Wallet/Loyalty this isn't a balance ledger —
 * a Referral progresses through a small, one-way state machine
 * (SIGNED_UP -> QUALIFIED -> REWARDED -> REVERSED, or SIGNED_UP -> EXPIRED),
 * so mutations are plain guarded UPDATEs on the row itself rather than
 * append-only transactions. REVERSED (not a mutable field on ReferralReward)
 * is the system of record for "was the referrer's reward clawed back" —
 * see referral.prisma's header.
 */
export interface ReferralRepository {
  create(input: CreateReferralInput): Promise<ReferralInfo>;
  findByProgramAndReferee(programId: bigint, refereeCustomerId: bigint): Promise<ReferralInfo | null>;
  findByQualifyingOrderId(qualifyingOrderId: bigint): Promise<ReferralInfo | null>;
  countByReferrer(programId: bigint, referrerCustomerId: bigint): Promise<number>;
  listByReferrer(programId: bigint, referrerCustomerId: bigint): Promise<ReferralInfo[]>;
  /** qualifyingOrderId is null for a SIGNUP-qualifying program (there is no order). */
  markQualified(id: bigint, qualifyingOrderId: bigint | null): Promise<ReferralInfo>;
  markRewarded(id: bigint): Promise<ReferralInfo>;
  markExpired(id: bigint): Promise<ReferralInfo>;
  markReversed(id: bigint): Promise<ReferralInfo>;
}

export interface ReferralRewardInfo {
  id: bigint;
  referralId: bigint;
  beneficiary: ReferralBeneficiary;
  rewardType: ReferralRewardType;
  amount: string | null;
  points: bigint | null;
  createdAt: Date;
}

export interface IssueReferralRewardInput {
  referralId: bigint;
  beneficiary: ReferralBeneficiary;
  rewardType: ReferralRewardType;
  amount?: string | null;
  points?: bigint | null;
}

/**
 * One-time reward grants, not a running balance — issuing one is a plain
 * insert; `@@unique([referralId, beneficiary])` is what makes a repeated
 * issuance attempt idempotent (checked in the application layer before
 * inserting, same "check first" idempotency discipline as the ledgers).
 * Truly immutable — a clawback is a new compensating entry in the
 * Wallet/Loyalty ledger plus Referral.status -> REVERSED, never a mutation
 * here (see referral.prisma's header).
 */
export interface ReferralRewardRepository {
  findByReferralAndBeneficiary(referralId: bigint, beneficiary: ReferralBeneficiary): Promise<ReferralRewardInfo | null>;
  create(input: IssueReferralRewardInput): Promise<ReferralRewardInfo>;
}
