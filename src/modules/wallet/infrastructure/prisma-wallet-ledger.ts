import { Prisma, type WalletBucket, type WalletSource, type WalletTxnType } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { WalletLedger, WalletSnapshot, WalletTransactionInfo, LedgerWriteOptions } from '../domain/repositories.js';
import { InsufficientBalanceError } from '../domain/errors.js';

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
  currency: string;
  status: string;
}

function toSnapshot(row: WalletRow): WalletSnapshot {
  return { id: row.id, publicId: row.public_id, balance: row.balance, currency: row.currency, status: row.status as WalletSnapshot['status'] };
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
    return row ? { id: row.id, publicId: row.publicId, balance: formatDecimal(row.balance), currency: row.currency, status: row.status } : null;
  }

  async findByCustomerId(customerId: bigint): Promise<WalletSnapshot | null> {
    const row = await this.db.wallet.findFirst({ where: { customerId } });
    return row ? { id: row.id, publicId: row.publicId, balance: formatDecimal(row.balance), currency: row.currency, status: row.status } : null;
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
         RETURNING id, public_id, balance::text, currency, status::text`;
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
      const rows = await tx.$queryRaw<WalletRow[]>`
        UPDATE wallet
           SET balance = balance - ${amount}::numeric
         WHERE id = ${walletId} AND balance >= ${amount}::numeric AND status = 'ACTIVE'
         RETURNING id, public_id, balance::text, currency, status::text`;
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
}
