import type { WalletBucket, WalletSource, WalletStatus, WalletTxnType } from '@prisma/client';

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
}
