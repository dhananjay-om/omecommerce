import type { LoyaltyProgramStatus, LoyaltySource, LoyaltyTxnType, WalletStatus } from '@prisma/client';

export interface CustomerContext {
  customerId: bigint;
  websiteId: bigint;
  currency: string;
}

/** Read-only cross-module lookup: a customer's own website + that website's base currency (own trivial copy, matching Wallet's identical-purpose lookup). */
export interface CustomerContextLookup {
  resolveByPublicId(customerPublicId: string): Promise<CustomerContext | null>;
}

export interface OrderContext {
  id: bigint;
  publicId: string;
  customerId: bigint | null;
  websiteId: bigint;
  grandTotal: string;
  status: string;
}

/** Read-only cross-module lookup: own trivial copy, used only by the worker (not Order module's repository). */
export interface OrderLookup {
  byPublicId(orderPublicId: string): Promise<OrderContext | null>;
}

export interface LoyaltyProgramInfo {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  name: string;
  status: LoyaltyProgramStatus;
  pointsPerCurrencyUnit: string;
  pointValue: string;
  redeemMinPoints: number;
  pointsExpiryMonths: number | null;
}

export interface CreateLoyaltyProgramInput {
  websiteId: bigint;
  name: string;
  pointsPerCurrencyUnit: string;
  pointValue: string;
  redeemMinPoints?: number;
  pointsExpiryMonths?: number | null;
  createdBy?: bigint;
}

export interface LoyaltyProgramRepository {
  create(input: CreateLoyaltyProgramInput): Promise<LoyaltyProgramInfo>;
  findByWebsiteId(websiteId: bigint): Promise<LoyaltyProgramInfo | null>;
  findByPublicId(publicId: string): Promise<LoyaltyProgramInfo | null>;
}

export interface LoyaltyTierInfo {
  id: bigint;
  programId: bigint;
  name: string;
  thresholdPoints: bigint;
  earnMultiplier: string;
  sortOrder: number;
}

export interface CreateLoyaltyTierInput {
  programId: bigint;
  name: string;
  thresholdPoints: bigint;
  earnMultiplier?: string;
  sortOrder?: number;
  createdBy?: bigint;
}

export interface LoyaltyTierRepository {
  create(input: CreateLoyaltyTierInput): Promise<LoyaltyTierInfo>;
  /** All tiers for a program, ordered by thresholdPoints descending — the first one whose threshold <= lifetimePoints is the customer's tier. */
  listByProgramId(programId: bigint): Promise<LoyaltyTierInfo[]>;
}

export interface LoyaltyAccountSnapshot {
  id: bigint;
  publicId: string;
  programId: bigint;
  pointsBalance: bigint;
  lifetimePoints: bigint;
  tierId: bigint | null;
  status: WalletStatus;
}

export interface LoyaltyTransactionInfo {
  type: LoyaltyTxnType;
  points: bigint;
  balanceAfter: bigint;
  source: LoyaltySource;
  reason: string | null;
  createdAt: Date;
}

export interface LedgerWriteOptions {
  refType?: string;
  refId?: bigint;
  idempotencyKey?: string;
  expiresAt?: Date;
  actorId?: bigint;
  reason?: string;
}

/**
 * The loyalty points ledger (plan/11 §2). Every mutation is a guarded UPDATE +
 * an append-only loyalty_transaction row, executed atomically — the same
 * discipline as StockLedger/WalletLedger/GiftCardLedger. Current pointsBalance
 * is a projection; nothing outside this port writes to loyalty_account
 * directly.
 */
export interface LoyaltyLedger {
  getOrCreateAccount(customerId: bigint, programId: bigint): Promise<{ id: bigint; publicId: string }>;
  findByPublicId(publicId: string): Promise<LoyaltyAccountSnapshot | null>;
  findByCustomerAndProgram(customerId: bigint, programId: bigint): Promise<LoyaltyAccountSnapshot | null>;

  /** Unguarded increment (can never go negative) but still one transaction with the ledger insert. `txnType` defaults to EARN. */
  earn(accountId: bigint, points: bigint, source: LoyaltySource, opts?: LedgerWriteOptions & { txnType?: LoyaltyTxnType }): Promise<LoyaltyAccountSnapshot>;

  /** Race-safe: throws InsufficientPointsError if pointsBalance < points or status != ACTIVE. `txnType` defaults to REDEEM. */
  redeem(accountId: bigint, points: bigint, source: LoyaltySource, opts?: LedgerWriteOptions & { txnType?: LoyaltyTxnType }): Promise<LoyaltyAccountSnapshot>;

  /** Best-effort guarded debit that floors at zero instead of throwing — used by clawback, which must never fail even if the points were already spent. */
  reverseUpTo(accountId: bigint, maxPoints: bigint, source: LoyaltySource, opts?: LedgerWriteOptions): Promise<{ pointsReversed: bigint; snapshot: LoyaltyAccountSnapshot }>;

  updateTier(accountId: bigint, tierId: bigint | null): Promise<void>;

  listTransactions(accountId: bigint): Promise<LoyaltyTransactionInfo[]>;

  /** Finds the original EARN transaction for a given (refType, refId) pair — used by clawback to know how many points an order originally earned. */
  findTransactionByRef(accountId: bigint, refType: string, refId: bigint, type: LoyaltyTxnType): Promise<LoyaltyTransactionInfo | null>;
}
