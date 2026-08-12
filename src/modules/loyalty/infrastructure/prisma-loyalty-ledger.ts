import type { LoyaltySource, LoyaltyTxnType } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  LoyaltyLedger,
  LoyaltyAccountSnapshot,
  LoyaltyTransactionInfo,
  LedgerWriteOptions,
} from '../domain/repositories.js';
import { InsufficientPointsError } from '../domain/errors.js';

interface AccountRow {
  id: bigint;
  public_id: string;
  program_id: bigint;
  points_balance: bigint;
  lifetime_points: bigint;
  tier_id: bigint | null;
  status: string;
}

function toSnapshot(row: AccountRow): LoyaltyAccountSnapshot {
  return {
    id: row.id,
    publicId: row.public_id,
    programId: row.program_id,
    pointsBalance: row.points_balance,
    lifetimePoints: row.lifetime_points,
    tierId: row.tier_id,
    status: row.status as LoyaltyAccountSnapshot['status'],
  };
}

function fromOrmRow(row: {
  id: bigint;
  publicId: string;
  programId: bigint;
  pointsBalance: bigint;
  lifetimePoints: bigint;
  tierId: bigint | null;
  status: string;
}): LoyaltyAccountSnapshot {
  return {
    id: row.id,
    publicId: row.publicId,
    programId: row.programId,
    pointsBalance: row.pointsBalance,
    lifetimePoints: row.lifetimePoints,
    tierId: row.tierId,
    status: row.status as LoyaltyAccountSnapshot['status'],
  };
}

const ACCOUNT_SELECT = { id: true, publicId: true, programId: true, pointsBalance: true, lifetimePoints: true, tierId: true, status: true } as const;

/**
 * The loyalty points ledger (plan/11 §2). Every mutation is a guarded, atomic
 * UPDATE + an append-only loyalty_transaction insert inside one transaction —
 * the exact same discipline as PrismaStockLedger/PrismaWalletLedger/
 * PrismaGiftCardLedger. Points are plain BIGINT (not NUMERIC), so raw-query
 * results come back as JS `bigint` natively — no Decimal-trailing-zero
 * workaround needed here (unlike the money-typed ledgers).
 *
 * Idempotency: when `opts.idempotencyKey` is given, a matching existing
 * transaction is checked FIRST (inside the same transaction) and short-
 * circuits to a no-op — this is what makes a re-delivered BullMQ job
 * (at-least-once) safe to reprocess. The DB's own
 * `uq_loyalty_txn_account_idempotency` unique constraint is the backstop for
 * the (rare, single-worker-today) race where two deliveries both pass the
 * check concurrently — that case surfaces as a raw unique-violation error to
 * the worker's failure handler rather than being silently swallowed.
 */
export class PrismaLoyaltyLedger implements LoyaltyLedger {
  constructor(private readonly db: Db) {}

  async getOrCreateAccount(customerId: bigint, programId: bigint): Promise<{ id: bigint; publicId: string }> {
    const account = await this.db.loyaltyAccount.upsert({
      where: { customerId_programId: { customerId, programId } },
      update: {},
      create: { customerId, programId },
    });
    return { id: account.id, publicId: account.publicId };
  }

  async findByPublicId(publicId: string): Promise<LoyaltyAccountSnapshot | null> {
    const row = await this.db.loyaltyAccount.findFirst({ where: { publicId }, select: ACCOUNT_SELECT });
    return row ? fromOrmRow(row) : null;
  }

  async findByCustomerAndProgram(customerId: bigint, programId: bigint): Promise<LoyaltyAccountSnapshot | null> {
    const row = await this.db.loyaltyAccount.findFirst({ where: { customerId, programId }, select: ACCOUNT_SELECT });
    return row ? fromOrmRow(row) : null;
  }

  async earn(
    accountId: bigint,
    points: bigint,
    source: LoyaltySource,
    opts: LedgerWriteOptions & { txnType?: LoyaltyTxnType } = {},
  ): Promise<LoyaltyAccountSnapshot> {
    return this.db.$transaction(async (tx) => {
      if (opts.idempotencyKey) {
        const existing = await tx.loyaltyTransaction.findFirst({ where: { loyaltyAccountId: accountId, idempotencyKey: opts.idempotencyKey } });
        if (existing) {
          const current = await tx.loyaltyAccount.findFirstOrThrow({ where: { id: accountId }, select: ACCOUNT_SELECT });
          return fromOrmRow(current);
        }
      }

      const txnType = opts.txnType ?? 'EARN';
      const rows = await tx.$queryRaw<AccountRow[]>`
        UPDATE loyalty_account
           SET points_balance = points_balance + ${points}, lifetime_points = lifetime_points + ${points}
         WHERE id = ${accountId}
         RETURNING id, public_id, program_id, points_balance, lifetime_points, tier_id, status::text`;
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO loyalty_transaction (loyalty_account_id, type, points, balance_after, source, ref_type, ref_id, idempotency_key, expires_at, actor_id, reason)
        VALUES (${accountId}, ${txnType}::"LoyaltyTxnType", ${points}, ${snapshot.points_balance}, ${source}::"LoyaltySource",
                ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null}, ${opts.expiresAt ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async redeem(
    accountId: bigint,
    points: bigint,
    source: LoyaltySource,
    opts: LedgerWriteOptions & { txnType?: LoyaltyTxnType } = {},
  ): Promise<LoyaltyAccountSnapshot> {
    return this.db.$transaction(async (tx) => {
      if (opts.idempotencyKey) {
        const existing = await tx.loyaltyTransaction.findFirst({ where: { loyaltyAccountId: accountId, idempotencyKey: opts.idempotencyKey } });
        if (existing) {
          const current = await tx.loyaltyAccount.findFirstOrThrow({ where: { id: accountId }, select: ACCOUNT_SELECT });
          return fromOrmRow(current);
        }
      }

      const txnType = opts.txnType ?? 'REDEEM';
      const rows = await tx.$queryRaw<AccountRow[]>`
        UPDATE loyalty_account
           SET points_balance = points_balance - ${points}
         WHERE id = ${accountId} AND points_balance >= ${points} AND status = 'ACTIVE'
         RETURNING id, public_id, program_id, points_balance, lifetime_points, tier_id, status::text`;
      if (rows.length === 0) {
        throw new InsufficientPointsError(points);
      }
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO loyalty_transaction (loyalty_account_id, type, points, balance_after, source, ref_type, ref_id, idempotency_key, actor_id, reason)
        VALUES (${accountId}, ${txnType}::"LoyaltyTxnType", ${-points}, ${snapshot.points_balance}, ${source}::"LoyaltySource",
                ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async reverseUpTo(
    accountId: bigint,
    maxPoints: bigint,
    source: LoyaltySource,
    opts: LedgerWriteOptions = {},
  ): Promise<{ pointsReversed: bigint; snapshot: LoyaltyAccountSnapshot }> {
    return this.db.$transaction(async (tx) => {
      if (opts.idempotencyKey) {
        const existing = await tx.loyaltyTransaction.findFirst({ where: { loyaltyAccountId: accountId, idempotencyKey: opts.idempotencyKey } });
        if (existing) {
          const current = await tx.loyaltyAccount.findFirstOrThrow({ where: { id: accountId }, select: ACCOUNT_SELECT });
          return { pointsReversed: 0n, snapshot: fromOrmRow(current) };
        }
      }

      // Lock the row first so we can compute exactly how much CAN be reversed
      // (floor at zero) rather than silently clamping inside the UPDATE.
      const locked = await tx.$queryRaw<AccountRow[]>`
        SELECT id, public_id, program_id, points_balance, lifetime_points, tier_id, status::text
        FROM loyalty_account WHERE id = ${accountId} FOR UPDATE`;
      const current = locked[0]!;
      const actualReverse = current.points_balance < maxPoints ? current.points_balance : maxPoints;
      if (actualReverse <= 0n) {
        return { pointsReversed: 0n, snapshot: toSnapshot(current) };
      }

      const rows = await tx.$queryRaw<AccountRow[]>`
        UPDATE loyalty_account
           SET points_balance = points_balance - ${actualReverse}
         WHERE id = ${accountId}
         RETURNING id, public_id, program_id, points_balance, lifetime_points, tier_id, status::text`;
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO loyalty_transaction (loyalty_account_id, type, points, balance_after, source, ref_type, ref_id, idempotency_key, actor_id, reason)
        VALUES (${accountId}, 'REVERSE'::"LoyaltyTxnType", ${-actualReverse}, ${snapshot.points_balance}, ${source}::"LoyaltySource",
                ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return { pointsReversed: actualReverse, snapshot: toSnapshot(snapshot) };
    });
  }

  async updateTier(accountId: bigint, tierId: bigint | null): Promise<void> {
    await this.db.loyaltyAccount.update({ where: { id: accountId }, data: { tierId } });
  }

  async listTransactions(accountId: bigint): Promise<LoyaltyTransactionInfo[]> {
    return this.db.loyaltyTransaction.findMany({
      where: { loyaltyAccountId: accountId },
      orderBy: { createdAt: 'desc' },
      select: { type: true, points: true, balanceAfter: true, source: true, reason: true, createdAt: true },
    });
  }

  async findTransactionByRef(accountId: bigint, refType: string, refId: bigint, type: LoyaltyTxnType): Promise<LoyaltyTransactionInfo | null> {
    return this.db.loyaltyTransaction.findFirst({
      where: { loyaltyAccountId: accountId, refType, refId, type },
      select: { type: true, points: true, balanceAfter: true, source: true, reason: true, createdAt: true },
    });
  }
}
