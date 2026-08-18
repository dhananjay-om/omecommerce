import type { WalletBucket, WalletSource, WalletStatus, WalletTxnType, ReservationRefType } from '@prisma/client';

export interface CustomerContext {
  customerId: bigint;
  websiteId: bigint;
  currency: string;
}

/** Read-only cross-module lookup: a customer's own website + that website's base currency (own trivial copy, not Customer module's repository). */
export interface CustomerContextLookup {
  resolveByPublicId(customerPublicId: string): Promise<CustomerContext | null>;
}

export interface WalletSnapshot {
  id: bigint;
  publicId: string;
  balance: string;
  /** Sum of this wallet's HELD checkout holds — `balance - heldBalance` is what a new hold is guarded against (plan/15 Phase 5). */
  heldBalance: string;
  currency: string;
  status: WalletStatus;
}

export interface WalletTransactionInfo {
  bucket: WalletBucket;
  type: WalletTxnType;
  amount: string;
  balanceAfter: string;
  currency: string;
  source: WalletSource;
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

/** A checkout-tender hold (plan/15 Phase 5) — structurally parallel to inventory's ReservationHandle. */
export interface StoredValueHoldHandle {
  id: bigint;
  publicId: string;
  amount: string;
  currency: string;
  expiresAt: Date | null;
}

/** A CAPTURED hold funding a settled order — RefundOrder's split-tender lookup. */
export interface CapturedWalletHold extends StoredValueHoldHandle {
  walletId: bigint;
}

/**
 * The wallet ledger (plan/10 §2/§5). Every mutation is a guarded UPDATE + an
 * append-only wallet_transaction row, executed atomically — the same
 * discipline as StockLedger (plan/07 §2). Current balance is a projection;
 * nothing outside this port writes to `wallet` directly.
 */
export interface WalletLedger {
  getOrCreateWallet(customerId: bigint, websiteId: bigint, currency: string): Promise<{ id: bigint; publicId: string }>;
  findByPublicId(publicId: string): Promise<WalletSnapshot | null>;
  findByCustomerId(customerId: bigint): Promise<WalletSnapshot | null>;

  /** Unguarded increment (can never go negative) but still one transaction with the ledger insert. `txnType` defaults to CREDIT — pass ADJUST for admin corrections. */
  credit(walletId: bigint, amount: string, bucket: WalletBucket, source: WalletSource, opts?: LedgerWriteOptions & { txnType?: WalletTxnType }): Promise<WalletSnapshot>;

  /** Race-safe: throws InsufficientBalanceError if balance < amount or status != ACTIVE. `txnType` defaults to DEBIT — pass ADJUST for admin corrections. */
  debit(walletId: bigint, amount: string, bucket: WalletBucket, source: WalletSource, opts?: LedgerWriteOptions & { txnType?: WalletTxnType }): Promise<WalletSnapshot>;

  freeze(walletId: bigint): Promise<void>;
  unfreeze(walletId: bigint): Promise<void>;

  listTransactions(walletId: bigint): Promise<WalletTransactionInfo[]>;

  /**
   * Checkout tender holds (plan/15 Phase 5) — a real two-phase hold, not
   * optimistic-debit-then-compensate, structurally identical to
   * StockLedger.reserve/commitReservation/releaseReservation. A HELD hold
   * moves no balance (only heldBalance), so hold() and releaseHold() never
   * write a wallet_transaction row — only captureHold() does, an ordinary
   * DEBIT (source ORDER).
   */

  /** Race-safe: throws InsufficientAvailableBalanceError if (balance - heldBalance) < amount or status != ACTIVE. */
  hold(walletId: bigint, amount: string, refType: ReservationRefType, refId: bigint, ttlSeconds?: number): Promise<StoredValueHoldHandle>;

  /** HELD -> CAPTURED: writes a real DEBIT wallet_transaction row (bucket STORE_CREDIT, source ORDER) and decrements both balance and heldBalance. */
  captureHold(holdPublicId: string): Promise<WalletSnapshot>;

  /** HELD -> RELEASED: heldBalance -= amount only; balance unchanged. */
  releaseHold(holdPublicId: string): Promise<void>;

  /** Sweeps HELD holds past expiresAt to EXPIRED. Returns count released. */
  releaseExpiredHolds(now: Date): Promise<number>;

  findHoldByPublicId(publicId: string): Promise<StoredValueHoldHandle | null>;

  /** Every CAPTURED wallet hold funding a given ref (e.g. an Order's originating Cart) — RefundOrder's split-tender lookup. */
  findCapturedHoldsByRef(refType: ReservationRefType, refId: bigint): Promise<CapturedWalletHold[]>;
}
