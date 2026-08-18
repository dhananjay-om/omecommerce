import type { GiftCardKind, GiftCardSource, GiftCardStatus, GiftCardTxnType, ReservationRefType } from '@prisma/client';

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
  /** Sum of this gift card's HELD checkout holds — `balance - heldBalance` is what a new hold is guarded against (plan/15 Phase 5). */
  heldBalance: string;
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

/** A checkout-tender hold (plan/15 Phase 5) — structurally parallel to inventory's ReservationHandle. */
export interface StoredValueHoldHandle {
  id: bigint;
  publicId: string;
  amount: string;
  currency: string;
  expiresAt: Date | null;
}

/** A CAPTURED hold funding a settled order — RefundOrder's split-tender lookup. */
export interface CapturedGiftCardHold extends StoredValueHoldHandle {
  giftCardId: bigint;
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
  /** By internal id — cart tenders reference a gift card by id (CartTender.giftCardId), not by code or publicId. */
  findById(giftCardId: bigint): Promise<GiftCardSnapshot | null>;

  /** Race-safe: throws InsufficientGiftCardBalanceError if balance < amount or status != ACTIVE. */
  redeem(giftCardId: bigint, amount: string, opts?: LedgerWriteOptions): Promise<GiftCardSnapshot>;

  /** Admin correction — can be positive (credit back) or negative (guarded debit). */
  adjust(giftCardId: bigint, amount: string, opts?: LedgerWriteOptions): Promise<GiftCardSnapshot>;

  disable(giftCardId: bigint): Promise<void>;

  listTransactions(giftCardId: bigint): Promise<GiftCardTransactionInfo[]>;

  /** Admin browse (Content > Gift Cards). Soft-delete-aware, newest first. */
  list(filter: ListGiftCardsFilter): Promise<GiftCardListResult>;

  /**
   * Checkout tender holds (plan/15 Phase 5) — a real two-phase hold, not
   * optimistic-debit-then-compensate, structurally identical to
   * StockLedger.reserve/commitReservation/releaseReservation and mirrored by
   * WalletLedger's own hold methods. A HELD hold moves no balance (only
   * heldBalance), so hold() and releaseHold() never write a
   * gift_card_transaction row — only captureHold() does, an ordinary REDEEM.
   */

  /** Race-safe: throws InsufficientAvailableGiftCardBalanceError if (balance - heldBalance) < amount or status != ACTIVE. */
  hold(giftCardId: bigint, amount: string, refType: ReservationRefType, refId: bigint, ttlSeconds?: number): Promise<StoredValueHoldHandle>;

  /** HELD -> CAPTURED: writes a real REDEEM gift_card_transaction row and decrements both balance and heldBalance. */
  captureHold(holdPublicId: string): Promise<GiftCardSnapshot>;

  /** HELD -> RELEASED: heldBalance -= amount only; balance unchanged. */
  releaseHold(holdPublicId: string): Promise<void>;

  /** Sweeps HELD holds past expiresAt to EXPIRED. Returns count released. */
  releaseExpiredHolds(now: Date): Promise<number>;

  findHoldByPublicId(publicId: string): Promise<StoredValueHoldHandle | null>;

  /** Every CAPTURED gift-card hold funding a given ref (e.g. an Order's originating Cart) — RefundOrder's split-tender lookup. */
  findCapturedHoldsByRef(refType: ReservationRefType, refId: bigint): Promise<CapturedGiftCardHold[]>;

  /** Unguarded positive credit, writing a REFUND-typed gift_card_transaction row (GiftCardTxnType.REFUND, reserved but unused until now) — the gift-card-side half of split-tender refund crediting. Reactivates a REDEEMED card back to ACTIVE if the credit brings its balance above zero. */
  refundCredit(giftCardId: bigint, amount: string, opts?: LedgerWriteOptions): Promise<GiftCardSnapshot>;
}
