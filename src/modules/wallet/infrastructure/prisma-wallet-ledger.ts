import { Prisma, type WalletBucket, type WalletSource, type WalletTxnType, type ReservationRefType } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { WalletLedger, WalletSnapshot, WalletTransactionInfo, LedgerWriteOptions, StoredValueHoldHandle, CapturedWalletHold } from '../domain/repositories.js';
import { InsufficientBalanceError, InsufficientAvailableBalanceError, InvalidWalletHoldStateError } from '../domain/errors.js';

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
// scale-4 string for plain ORM reads. The guarded-UPDATE raw SQL queries below
// avoid this entirely via an explicit ::text cast in the RETURNING clause.
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

interface WalletRow {
  id: bigint;
  public_id: string;
  balance: string;
  held_balance: string;
  currency: string;
  status: string;
}

function toSnapshot(row: WalletRow): WalletSnapshot {
  return {
    id: row.id,
    publicId: row.public_id,
    balance: row.balance,
    heldBalance: row.held_balance,
    currency: row.currency,
    status: row.status as WalletSnapshot['status'],
  };
}

/**
 * The wallet ledger (plan/10 §2/§5). Every mutation is a guarded, atomic
 * UPDATE + an append-only wallet_transaction insert inside one transaction —
 * the exact same discipline as PrismaStockLedger. `credit()` can't go
 * negative so its UPDATE is unguarded, but it still runs inside the same
 * transaction as the ledger insert for atomicity.
 */
export class PrismaWalletLedger implements WalletLedger {
  constructor(private readonly db: Db) {}

  async getOrCreateWallet(customerId: bigint, websiteId: bigint, currency: string): Promise<{ id: bigint; publicId: string }> {
    try {
      const wallet = await this.db.wallet.upsert({
        where: { customerId_websiteId_currency: { customerId, websiteId, currency } },
        update: {},
        create: { customerId, websiteId, currency },
      });
      return { id: wallet.id, publicId: wallet.publicId };
    } catch (err) {
      // Two concurrent lazy-creates for the same brand-new customer's wallet
      // (e.g. the admin Wallet tab's Promise.all firing GetWalletBalance and
      // ListWalletTransactions in parallel — both call this) can both see "no
      // row" before either commits, so upsert()'s own conflict handling loses
      // the race and one caller gets a raw P2002 instead of a resolved
      // update. The loser just re-reads what the winner created.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const wallet = await this.db.wallet.findFirstOrThrow({ where: { customerId, websiteId, currency } });
        return { id: wallet.id, publicId: wallet.publicId };
      }
      throw err;
    }
  }

  async findByPublicId(publicId: string): Promise<WalletSnapshot | null> {
    const row = await this.db.wallet.findFirst({ where: { publicId } });
    return row
      ? { id: row.id, publicId: row.publicId, balance: formatDecimal(row.balance), heldBalance: formatDecimal(row.heldBalance), currency: row.currency, status: row.status }
      : null;
  }

  async findByCustomerId(customerId: bigint): Promise<WalletSnapshot | null> {
    const row = await this.db.wallet.findFirst({ where: { customerId } });
    return row
      ? { id: row.id, publicId: row.publicId, balance: formatDecimal(row.balance), heldBalance: formatDecimal(row.heldBalance), currency: row.currency, status: row.status }
      : null;
  }

  async credit(
    walletId: bigint,
    amount: string,
    bucket: WalletBucket,
    source: WalletSource,
    opts: LedgerWriteOptions & { txnType?: WalletTxnType } = {},
  ): Promise<WalletSnapshot> {
    const txnType = opts.txnType ?? 'CREDIT';
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<WalletRow[]>`
        UPDATE wallet
           SET balance = balance + ${amount}::numeric
         WHERE id = ${walletId}
         RETURNING id, public_id, balance::text, held_balance::text, currency, status::text`;
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO wallet_transaction
          (wallet_id, bucket, type, amount, balance_after, currency, source, ref_type, ref_id, idempotency_key, expires_at, actor_id, reason)
        VALUES
          (${walletId}, ${bucket}::"WalletBucket", ${txnType}::"WalletTxnType", ${amount}::numeric, ${snapshot.balance}::numeric, ${snapshot.currency},
           ${source}::"WalletSource", ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null},
           ${opts.expiresAt ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async debit(
    walletId: bigint,
    amount: string,
    bucket: WalletBucket,
    source: WalletSource,
    opts: LedgerWriteOptions & { txnType?: WalletTxnType } = {},
  ): Promise<WalletSnapshot> {
    const txnType = opts.txnType ?? 'DEBIT';
    return this.db.$transaction(async (tx) => {
      // Guarded against (balance - held_balance), not balance — same held-balance-aware
      // guard as hold() below. Without this, a debit (admin adjust, referral clawback)
      // could spend value a concurrent checkout hold already earmarked, and the later
      // captureHold() would then drive the wallet negative capturing money debit() just
      // took (plan/15 code-review finding: wallet double-spend via held_balance bypass).
      const rows = await tx.$queryRaw<WalletRow[]>`
        UPDATE wallet
           SET balance = balance - ${amount}::numeric
         WHERE id = ${walletId} AND (balance - held_balance) >= ${amount}::numeric AND status = 'ACTIVE'
         RETURNING id, public_id, balance::text, held_balance::text, currency, status::text`;
      if (rows.length === 0) {
        throw new InsufficientBalanceError(amount);
      }
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO wallet_transaction
          (wallet_id, bucket, type, amount, balance_after, currency, source, ref_type, ref_id, idempotency_key, expires_at, actor_id, reason)
        VALUES
          (${walletId}, ${bucket}::"WalletBucket", ${txnType}::"WalletTxnType", ${'-' + amount}::numeric, ${snapshot.balance}::numeric, ${snapshot.currency},
           ${source}::"WalletSource", ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null},
           ${opts.expiresAt ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async freeze(walletId: bigint): Promise<void> {
    await this.db.wallet.update({ where: { id: walletId }, data: { status: 'FROZEN' } });
  }

  async unfreeze(walletId: bigint): Promise<void> {
    await this.db.wallet.update({ where: { id: walletId }, data: { status: 'ACTIVE' } });
  }

  async listTransactions(walletId: bigint): Promise<WalletTransactionInfo[]> {
    const rows = await this.db.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      select: { bucket: true, type: true, amount: true, balanceAfter: true, currency: true, source: true, reason: true, createdAt: true },
    });
    return rows.map((r) => ({
      bucket: r.bucket,
      type: r.type,
      amount: formatDecimal(r.amount),
      balanceAfter: formatDecimal(r.balanceAfter),
      currency: r.currency,
      source: r.source,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }

  async hold(
    walletId: bigint,
    amount: string,
    refType: ReservationRefType,
    refId: bigint,
    ttlSeconds: number = DEFAULT_HOLD_TTL_SECONDS,
  ): Promise<StoredValueHoldHandle> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return this.db.$transaction(async (tx) => {
      // Guarded exactly like debit(), but against (balance - held_balance) —
      // the wallet's own currency, not the caller's, is trusted for the new
      // row (mirrors PrismaStockLedger.reserve not trusting caller input for
      // anything the stock_item row itself already knows).
      const rows = await tx.$queryRaw<Array<{ id: bigint; currency: string }>>`
        UPDATE wallet
           SET held_balance = held_balance + ${amount}::numeric
         WHERE id = ${walletId} AND (balance - held_balance) >= ${amount}::numeric AND status = 'ACTIVE'
         RETURNING id, currency`;
      if (rows.length === 0) {
        throw new InsufficientAvailableBalanceError(amount);
      }
      const wallet = rows[0]!;
      const hold = await tx.$queryRaw<HoldRow[]>`
        INSERT INTO stored_value_hold (tender_type, wallet_id, amount, currency, ref_type, ref_id, status, expires_at)
        VALUES ('WALLET'::"TenderType", ${walletId}, ${amount}::numeric, ${wallet.currency}, ${refType}::"ReservationRefType", ${refId}, 'HELD', ${expiresAt})
        RETURNING id, public_id, amount::text, currency, expires_at`;
      return toHoldHandle(hold[0]!);
    });
  }

  async captureHold(holdPublicId: string): Promise<WalletSnapshot> {
    return this.db.$transaction(async (tx) => {
      const holdRows = await tx.$queryRaw<Array<{ wallet_id: bigint; amount: string }>>`
        UPDATE stored_value_hold
           SET status = 'CAPTURED'
         WHERE public_id = ${holdPublicId}::uuid AND status = 'HELD' AND wallet_id IS NOT NULL
         RETURNING wallet_id, amount::text`;
      if (holdRows.length === 0) {
        throw new InvalidWalletHoldStateError(`wallet hold ${holdPublicId} is not HELD`);
      }
      const { wallet_id, amount } = holdRows[0]!;
      // Guarded the same as debit()/hold() — a hold's held_balance should always be
      // covered by the time it's captured, but this is the last line of defense against
      // driving the wallet negative if that invariant was ever violated upstream (e.g. a
      // manual DB correction, or a future bug in another mutation path).
      const rows = await tx.$queryRaw<WalletRow[]>`
        UPDATE wallet
           SET balance = balance - ${amount}::numeric, held_balance = held_balance - ${amount}::numeric
         WHERE id = ${wallet_id} AND balance >= ${amount}::numeric AND held_balance >= ${amount}::numeric
         RETURNING id, public_id, balance::text, held_balance::text, currency, status::text`;
      if (rows.length === 0) {
        throw new InsufficientBalanceError(amount);
      }
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO wallet_transaction (wallet_id, bucket, type, amount, balance_after, currency, source, ref_type, ref_id)
        VALUES (${wallet_id}, 'STORE_CREDIT'::"WalletBucket", 'DEBIT'::"WalletTxnType", ${'-' + amount}::numeric, ${snapshot.balance}::numeric,
                ${snapshot.currency}, 'ORDER'::"WalletSource", 'ORDER', ${wallet_id})`;
      return toSnapshot(snapshot);
    });
  }

  async releaseHold(holdPublicId: string): Promise<void> {
    await this.releaseByStatus(holdPublicId, 'RELEASED');
  }

  async releaseExpiredHolds(now: Date): Promise<number> {
    const expired = await this.db.storedValueHold.findMany({
      where: { status: 'HELD', walletId: { not: null }, expiresAt: { lt: now } },
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
      const holdRows = await tx.$queryRaw<Array<{ wallet_id: bigint; amount: string }>>`
        UPDATE stored_value_hold
           SET status = ${toStatus}::"StoredValueHoldStatus"
         WHERE public_id = ${holdPublicId}::uuid AND status = 'HELD' AND wallet_id IS NOT NULL
         RETURNING wallet_id, amount::text`;
      if (holdRows.length === 0) {
        throw new InvalidWalletHoldStateError(`wallet hold ${holdPublicId} is not HELD`);
      }
      const { wallet_id, amount } = holdRows[0]!;
      await tx.$executeRaw`
        UPDATE wallet SET held_balance = held_balance - ${amount}::numeric WHERE id = ${wallet_id} AND held_balance >= ${amount}::numeric`;
    });
  }

  async findHoldByPublicId(publicId: string): Promise<StoredValueHoldHandle | null> {
    const row = await this.db.storedValueHold.findFirst({ where: { publicId, walletId: { not: null } } });
    return row ? { id: row.id, publicId: row.publicId, amount: formatDecimal(row.amount), currency: row.currency, expiresAt: row.expiresAt } : null;
  }

  async findCapturedHoldsByRef(refType: ReservationRefType, refId: bigint): Promise<CapturedWalletHold[]> {
    const rows = await this.db.storedValueHold.findMany({
      where: { refType, refId, status: 'CAPTURED', walletId: { not: null } },
    });
    return rows.map((r) => ({
      id: r.id,
      publicId: r.publicId,
      amount: formatDecimal(r.amount),
      currency: r.currency,
      expiresAt: r.expiresAt,
      walletId: r.walletId!,
    }));
  }
}
