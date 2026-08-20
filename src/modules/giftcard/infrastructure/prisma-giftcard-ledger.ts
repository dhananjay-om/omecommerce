import type { Prisma, ReservationRefType } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits, isNegative } from '../../../shared/domain/decimal.js';
import type {
  GiftCardLedger,
  GiftCardSnapshot,
  GiftCardTransactionInfo,
  IssueGiftCardInput,
  LedgerWriteOptions,
  ListGiftCardsFilter,
  GiftCardListResult,
  StoredValueHoldHandle,
  CapturedGiftCardHold,
} from '../domain/repositories.js';
import { InsufficientGiftCardBalanceError, InsufficientAvailableGiftCardBalanceError, InvalidGiftCardHoldStateError } from '../domain/errors.js';

/** Default checkout-hold TTL — same 15-minute window as inventory's DEFAULT_RESERVATION_TTL_SECONDS
 *  (src/modules/inventory/domain/reservation.ts), own copy per this project's per-module convention. */
const DEFAULT_HOLD_TTL_SECONDS = 900;

interface HoldRow {
  id: bigint;
  public_id: string;
  amount: string;
  currency: string;
  expires_at: Date | null;
}

function toHoldHandle(row: HoldRow): StoredValueHoldHandle {
  return { id: row.id, publicId: row.public_id, amount: row.amount, currency: row.currency, expiresAt: row.expires_at };
}

// Prisma's Decimal.toString() strips trailing zeros ("100.0000" -> "100");
// this round-trip through the fixed-point minor-units helpers restores the
// scale-4 string for plain ORM reads. The guarded-UPDATE raw SQL queries
// below avoid this entirely via an explicit ::text cast in RETURNING.
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

interface GiftCardRow {
  id: bigint;
  public_id: string;
  website_id: bigint;
  code_last4: string;
  initial_amount: string;
  balance: string;
  held_balance: string;
  currency: string;
  status: string;
  kind: string;
  source: string;
  expires_at: Date | null;
}

function toSnapshot(row: GiftCardRow): GiftCardSnapshot {
  return {
    id: row.id,
    publicId: row.public_id,
    websiteId: row.website_id,
    codeLast4: row.code_last4,
    initialAmount: row.initial_amount,
    balance: row.balance,
    heldBalance: row.held_balance,
    currency: row.currency,
    status: row.status as GiftCardSnapshot['status'],
    kind: row.kind as GiftCardSnapshot['kind'],
    source: row.source as GiftCardSnapshot['source'],
    expiresAt: row.expires_at,
  };
}

const GIFT_CARD_SELECT = {
  id: true,
  publicId: true,
  websiteId: true,
  codeLast4: true,
  initialAmount: true,
  balance: true,
  heldBalance: true,
  currency: true,
  status: true,
  kind: true,
  source: true,
  expiresAt: true,
} as const;

function fromOrmRow(row: {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  codeLast4: string;
  initialAmount: { toString(): string };
  balance: { toString(): string };
  heldBalance: { toString(): string };
  currency: string;
  status: string;
  kind: string;
  source: string;
  expiresAt: Date | null;
}): GiftCardSnapshot {
  return {
    id: row.id,
    publicId: row.publicId,
    websiteId: row.websiteId,
    codeLast4: row.codeLast4,
    initialAmount: formatDecimal(row.initialAmount),
    balance: formatDecimal(row.balance),
    heldBalance: formatDecimal(row.heldBalance),
    currency: row.currency,
    status: row.status as GiftCardSnapshot['status'],
    kind: row.kind as GiftCardSnapshot['kind'],
    source: row.source as GiftCardSnapshot['source'],
    expiresAt: row.expiresAt,
  };
}

/**
 * The gift card ledger (plan/10 §2/§5/§3). Every mutation is a guarded, atomic
 * UPDATE + an append-only gift_card_transaction insert inside one transaction
 * — the exact same discipline as PrismaStockLedger/PrismaWalletLedger.
 */
export class PrismaGiftCardLedger implements GiftCardLedger {
  constructor(private readonly db: Db) {}

  async issue(input: IssueGiftCardInput): Promise<GiftCardSnapshot> {
    return this.db.$transaction(async (tx) => {
      const card = await tx.giftCard.create({
        data: {
          websiteId: input.websiteId,
          codeHash: input.codeHash,
          codeLast4: input.codeLast4,
          initialAmount: input.initialAmount,
          balance: input.initialAmount,
          currency: input.currency,
          kind: input.kind,
          source: input.source,
          purchaserCustomerId: input.purchaserCustomerId,
          recipientEmail: input.recipientEmail,
          recipientName: input.recipientName,
          message: input.message,
          expiresAt: input.expiresAt,
          createdBy: input.createdBy,
        },
        select: GIFT_CARD_SELECT,
      });
      await tx.giftCardTransaction.create({
        data: {
          giftCardId: card.id,
          type: 'ISSUE',
          amount: input.initialAmount,
          balanceAfter: input.initialAmount,
          currency: input.currency,
          actorId: input.createdBy,
          reason: 'issued',
        },
      });
      return fromOrmRow(card);
    });
  }

  async findByCodeHash(codeHash: string): Promise<GiftCardSnapshot | null> {
    const row = await this.db.giftCard.findFirst({ where: { codeHash }, select: GIFT_CARD_SELECT });
    return row ? fromOrmRow(row) : null;
  }

  async findByPublicId(publicId: string): Promise<GiftCardSnapshot | null> {
    const row = await this.db.giftCard.findFirst({ where: { publicId }, select: GIFT_CARD_SELECT });
    return row ? fromOrmRow(row) : null;
  }

  async findById(giftCardId: bigint): Promise<GiftCardSnapshot | null> {
    const row = await this.db.giftCard.findFirst({ where: { id: giftCardId }, select: GIFT_CARD_SELECT });
    return row ? fromOrmRow(row) : null;
  }

  async redeem(giftCardId: bigint, amount: string, opts: LedgerWriteOptions = {}): Promise<GiftCardSnapshot> {
    return this.db.$transaction(async (tx) => {
      // Guarded against (balance - held_balance), not balance — same held-balance-aware
      // guard as hold() below. Without this, redeeming a card into a wallet (or any other
      // redeem caller) could spend value a concurrent checkout hold already earmarked, and
      // the later captureHold() would then drive the card negative capturing money redeem()
      // just took (plan/15 code-review finding: gift card double-spend via held_balance bypass).
      const rows = await tx.$queryRaw<GiftCardRow[]>`
        UPDATE gift_card
           SET balance = balance - ${amount}::numeric,
               status = CASE WHEN balance - ${amount}::numeric = 0 THEN 'REDEEMED'::"GiftCardStatus" ELSE status END
         WHERE id = ${giftCardId} AND (balance - held_balance) >= ${amount}::numeric AND status = 'ACTIVE'
         RETURNING id, public_id, website_id, code_last4, initial_amount::text, balance::text, held_balance::text, currency, status::text, kind::text, source::text, expires_at`;
      if (rows.length === 0) {
        throw new InsufficientGiftCardBalanceError(amount);
      }
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO gift_card_transaction (gift_card_id, type, amount, balance_after, currency, ref_type, ref_id, idempotency_key, actor_id, reason)
        VALUES (${giftCardId}, 'REDEEM'::"GiftCardTxnType", ${'-' + amount}::numeric, ${snapshot.balance}::numeric, ${snapshot.currency},
                ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async adjust(giftCardId: bigint, amount: string, opts: LedgerWriteOptions = {}): Promise<GiftCardSnapshot> {
    const minor = toMinorUnits(amount);
    if (isNegative(minor)) {
      const magnitude = fromMinorUnits(-minor);
      return this.db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<GiftCardRow[]>`
          UPDATE gift_card
             SET balance = balance - ${magnitude}::numeric
           WHERE id = ${giftCardId} AND balance >= ${magnitude}::numeric AND status = 'ACTIVE'
           RETURNING id, public_id, website_id, code_last4, initial_amount::text, balance::text, held_balance::text, currency, status::text, kind::text, source::text, expires_at`;
        if (rows.length === 0) {
          throw new InsufficientGiftCardBalanceError(magnitude);
        }
        const snapshot = rows[0]!;
        await tx.$executeRaw`
          INSERT INTO gift_card_transaction (gift_card_id, type, amount, balance_after, currency, actor_id, reason)
          VALUES (${giftCardId}, 'ADJUST'::"GiftCardTxnType", ${'-' + magnitude}::numeric, ${snapshot.balance}::numeric, ${snapshot.currency}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
        return toSnapshot(snapshot);
      });
    }
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<GiftCardRow[]>`
        UPDATE gift_card
           SET balance = balance + ${amount}::numeric
         WHERE id = ${giftCardId}
         RETURNING id, public_id, website_id, code_last4, initial_amount::text, balance::text, held_balance::text, currency, status::text, kind::text, source::text, expires_at`;
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO gift_card_transaction (gift_card_id, type, amount, balance_after, currency, actor_id, reason)
        VALUES (${giftCardId}, 'ADJUST'::"GiftCardTxnType", ${amount}::numeric, ${snapshot.balance}::numeric, ${snapshot.currency}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async disable(giftCardId: bigint): Promise<void> {
    await this.db.giftCard.update({ where: { id: giftCardId }, data: { status: 'DISABLED' } });
  }

  async listTransactions(giftCardId: bigint): Promise<GiftCardTransactionInfo[]> {
    const rows = await this.db.giftCardTransaction.findMany({
      where: { giftCardId },
      orderBy: { createdAt: 'desc' },
      select: { type: true, amount: true, balanceAfter: true, currency: true, reason: true, createdAt: true },
    });
    return rows.map((r) => ({
      type: r.type,
      amount: formatDecimal(r.amount),
      balanceAfter: formatDecimal(r.balanceAfter),
      currency: r.currency,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }

  async list(filter: ListGiftCardsFilter): Promise<GiftCardListResult> {
    const where: Prisma.GiftCardWhereInput = {
      deletedAt: null,
      ...(filter.websiteId ? { websiteId: filter.websiteId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.last4 ? { codeLast4: filter.last4 } : {}),
      ...(filter.recipientEmail ? { recipientEmail: { contains: filter.recipientEmail, mode: 'insensitive' } } : {}),
    };
    const [total, rows] = await this.db.$transaction([
      this.db.giftCard.count({ where }),
      this.db.giftCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        select: {
          publicId: true,
          codeLast4: true,
          initialAmount: true,
          balance: true,
          currency: true,
          status: true,
          kind: true,
          recipientEmail: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      total,
      giftCards: rows.map((r) => ({
        publicId: r.publicId,
        codeLast4: r.codeLast4,
        initialAmount: formatDecimal(r.initialAmount),
        balance: formatDecimal(r.balance),
        currency: r.currency,
        status: r.status,
        kind: r.kind,
        recipientEmail: r.recipientEmail,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      })),
    };
  }

  async hold(
    giftCardId: bigint,
    amount: string,
    refType: ReservationRefType,
    refId: bigint,
    ttlSeconds: number = DEFAULT_HOLD_TTL_SECONDS,
  ): Promise<StoredValueHoldHandle> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint; currency: string }>>`
        UPDATE gift_card
           SET held_balance = held_balance + ${amount}::numeric
         WHERE id = ${giftCardId} AND (balance - held_balance) >= ${amount}::numeric AND status = 'ACTIVE'
         RETURNING id, currency`;
      if (rows.length === 0) {
        throw new InsufficientAvailableGiftCardBalanceError(amount);
      }
      const card = rows[0]!;
      const hold = await tx.$queryRaw<HoldRow[]>`
        INSERT INTO stored_value_hold (tender_type, gift_card_id, amount, currency, ref_type, ref_id, status, expires_at)
        VALUES ('GIFT_CARD'::"TenderType", ${giftCardId}, ${amount}::numeric, ${card.currency}, ${refType}::"ReservationRefType", ${refId}, 'HELD', ${expiresAt})
        RETURNING id, public_id, amount::text, currency, expires_at`;
      return toHoldHandle(hold[0]!);
    });
  }

  async captureHold(holdPublicId: string): Promise<GiftCardSnapshot> {
    return this.db.$transaction(async (tx) => {
      const holdRows = await tx.$queryRaw<Array<{ gift_card_id: bigint; amount: string }>>`
        UPDATE stored_value_hold
           SET status = 'CAPTURED'
         WHERE public_id = ${holdPublicId}::uuid AND status = 'HELD' AND gift_card_id IS NOT NULL
         RETURNING gift_card_id, amount::text`;
      if (holdRows.length === 0) {
        throw new InvalidGiftCardHoldStateError(`gift card hold ${holdPublicId} is not HELD`);
      }
      const { gift_card_id, amount } = holdRows[0]!;
      // Guarded the same as redeem()/hold() — a hold's held_balance should always be
      // covered by the time it's captured, but this is the last line of defense against
      // driving the card negative if that invariant was ever violated upstream (e.g. a
      // manual DB correction, or a future bug in another mutation path).
      const rows = await tx.$queryRaw<GiftCardRow[]>`
        UPDATE gift_card
           SET balance = balance - ${amount}::numeric, held_balance = held_balance - ${amount}::numeric,
               status = CASE WHEN balance - ${amount}::numeric = 0 THEN 'REDEEMED'::"GiftCardStatus" ELSE status END
         WHERE id = ${gift_card_id} AND balance >= ${amount}::numeric AND held_balance >= ${amount}::numeric
         RETURNING id, public_id, website_id, code_last4, initial_amount::text, balance::text, held_balance::text, currency, status::text, kind::text, source::text, expires_at`;
      if (rows.length === 0) {
        throw new InsufficientGiftCardBalanceError(amount);
      }
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO gift_card_transaction (gift_card_id, type, amount, balance_after, currency, ref_type, ref_id)
        VALUES (${gift_card_id}, 'REDEEM'::"GiftCardTxnType", ${'-' + amount}::numeric, ${snapshot.balance}::numeric, ${snapshot.currency}, 'ORDER', ${gift_card_id})`;
      return toSnapshot(snapshot);
    });
  }

  async releaseHold(holdPublicId: string): Promise<void> {
    await this.releaseByStatus(holdPublicId, 'RELEASED');
  }

  async releaseExpiredHolds(now: Date): Promise<number> {
    const expired = await this.db.storedValueHold.findMany({
      where: { status: 'HELD', giftCardId: { not: null }, expiresAt: { lt: now } },
      select: { publicId: true },
    });
    let count = 0;
    for (const h of expired) {
      try {
        await this.releaseByStatus(h.publicId, 'EXPIRED');
        count++;
      } catch {
        // lost a race with a concurrent capture/release — not an error for the sweep
      }
    }
    return count;
  }

  private async releaseByStatus(holdPublicId: string, toStatus: 'RELEASED' | 'EXPIRED'): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const holdRows = await tx.$queryRaw<Array<{ gift_card_id: bigint; amount: string }>>`
        UPDATE stored_value_hold
           SET status = ${toStatus}::"StoredValueHoldStatus"
         WHERE public_id = ${holdPublicId}::uuid AND status = 'HELD' AND gift_card_id IS NOT NULL
         RETURNING gift_card_id, amount::text`;
      if (holdRows.length === 0) {
        throw new InvalidGiftCardHoldStateError(`gift card hold ${holdPublicId} is not HELD`);
      }
      const { gift_card_id, amount } = holdRows[0]!;
      await tx.$executeRaw`
        UPDATE gift_card SET held_balance = held_balance - ${amount}::numeric WHERE id = ${gift_card_id} AND held_balance >= ${amount}::numeric`;
    });
  }

  async findHoldByPublicId(publicId: string): Promise<StoredValueHoldHandle | null> {
    const row = await this.db.storedValueHold.findFirst({ where: { publicId, giftCardId: { not: null } } });
    return row ? { id: row.id, publicId: row.publicId, amount: formatDecimal(row.amount), currency: row.currency, expiresAt: row.expiresAt } : null;
  }

  async findCapturedHoldsByRef(refType: ReservationRefType, refId: bigint): Promise<CapturedGiftCardHold[]> {
    const rows = await this.db.storedValueHold.findMany({
      where: { refType, refId, status: 'CAPTURED', giftCardId: { not: null } },
    });
    return rows.map((r) => ({
      id: r.id,
      publicId: r.publicId,
      amount: formatDecimal(r.amount),
      currency: r.currency,
      expiresAt: r.expiresAt,
      giftCardId: r.giftCardId!,
    }));
  }

  async refundCredit(giftCardId: bigint, amount: string, opts: LedgerWriteOptions = {}): Promise<GiftCardSnapshot> {
    return this.db.$transaction(async (tx) => {
      // Unguarded (can only ever go up) — reactivates a fully-REDEEMED card
      // back to ACTIVE, same reasoning a partial refund landing on a
      // DISABLED/EXPIRED card should NOT silently reactivate: only the
      // REDEEMED -> ACTIVE edge is safe to flip automatically here.
      const rows = await tx.$queryRaw<GiftCardRow[]>`
        UPDATE gift_card
           SET balance = balance + ${amount}::numeric,
               status = CASE WHEN status = 'REDEEMED' THEN 'ACTIVE'::"GiftCardStatus" ELSE status END
         WHERE id = ${giftCardId}
         RETURNING id, public_id, website_id, code_last4, initial_amount::text, balance::text, held_balance::text, currency, status::text, kind::text, source::text, expires_at`;
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO gift_card_transaction (gift_card_id, type, amount, balance_after, currency, ref_type, ref_id, actor_id, reason)
        VALUES (${giftCardId}, 'REFUND'::"GiftCardTxnType", ${amount}::numeric, ${snapshot.balance}::numeric, ${snapshot.currency},
                ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }
}
