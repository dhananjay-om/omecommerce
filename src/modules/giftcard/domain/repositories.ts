import type { GiftCardKind, GiftCardSource, GiftCardStatus, GiftCardTxnType } from '@prisma/client';

/** Read-only cross-module lookup: resolves a website's code to its internal id + base currency (own trivial copy, not Pricing/Customer module's repository). */
export interface WebsiteLookup {
  byCode(code: string): Promise<{ id: bigint; baseCurrency: string } | null>;
}

/** Read-only cross-module lookup: resolves a customer's publicId to their internal id (own trivial copy). */
export interface CustomerLookup {
  findIdByPublicId(customerPublicId: string): Promise<bigint | null>;
}

export interface GiftCardSnapshot {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  codeLast4: string;
  initialAmount: string;
  balance: string;
  currency: string;
  status: GiftCardStatus;
  kind: GiftCardKind;
  source: GiftCardSource;
  expiresAt: Date | null;
}

export interface IssueGiftCardInput {
  websiteId: bigint;
  codeHash: string;
  codeLast4: string;
  initialAmount: string;
  currency: string;
  kind: GiftCardKind;
  source: GiftCardSource;
  purchaserCustomerId?: bigint | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  message?: string | null;
  expiresAt?: Date | null;
  createdBy?: bigint;
}

export interface GiftCardTransactionInfo {
  type: GiftCardTxnType;
  amount: string;
  balanceAfter: string;
  currency: string;
  reason: string | null;
  createdAt: Date;
}

export interface LedgerWriteOptions {
  refType?: string;
  refId?: bigint;
  idempotencyKey?: string;
  actorId?: bigint;
  reason?: string;
}

export interface ListGiftCardsFilter {
  websiteId?: bigint;
  status?: GiftCardStatus;
  last4?: string;
  recipientEmail?: string;
  page: number;
  pageSize: number;
}

export interface GiftCardListRow {
  publicId: string;
  codeLast4: string;
  initialAmount: string;
  balance: string;
  currency: string;
  status: GiftCardStatus;
  kind: GiftCardKind;
  recipientEmail: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface GiftCardListResult {
  total: number;
  giftCards: GiftCardListRow[];
}

/**
 * The gift card ledger (plan/10 §2/§5). Every mutation is a guarded UPDATE + an
 * append-only gift_card_transaction row, executed atomically — the same
 * discipline as StockLedger/WalletLedger. Current balance is a projection.
 */
export interface GiftCardLedger {
  issue(input: IssueGiftCardInput): Promise<GiftCardSnapshot>;
  findByCodeHash(codeHash: string): Promise<GiftCardSnapshot | null>;
  findByPublicId(publicId: string): Promise<GiftCardSnapshot | null>;

  /** Race-safe: throws InsufficientGiftCardBalanceError if balance < amount or status != ACTIVE. */
  redeem(giftCardId: bigint, amount: string, opts?: LedgerWriteOptions): Promise<GiftCardSnapshot>;

  /** Admin correction — can be positive (credit back) or negative (guarded debit). */
  adjust(giftCardId: bigint, amount: string, opts?: LedgerWriteOptions): Promise<GiftCardSnapshot>;

  disable(giftCardId: bigint): Promise<void>;

  listTransactions(giftCardId: bigint): Promise<GiftCardTransactionInfo[]>;

  /** Admin browse (Content > Gift Cards). Soft-delete-aware, newest first. */
  list(filter: ListGiftCardsFilter): Promise<GiftCardListResult>;
}
