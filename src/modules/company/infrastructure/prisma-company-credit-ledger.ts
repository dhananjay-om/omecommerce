import { Prisma, type CreditTermsType } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type {
  CompanyCreditLedger,
  CompanyCreditAccountSnapshot,
  CompanyCreditTransactionInfo,
  CreditLedgerWriteOptions,
  OpenInvoiceRow,
} from '../domain/repositories.js';
import { CreditLimitExceededError, PaymentExceedsOutstandingError } from '../domain/errors.js';
import { computeDueAt } from '../domain/credit-terms.js';

interface AccountRow {
  id: bigint;
  public_id: string;
  company_id: bigint;
  credit_limit: string;
  outstanding: string;
  currency: string;
  terms_type: string;
  status: string;
}

function toSnapshot(row: AccountRow): CompanyCreditAccountSnapshot {
  return {
    id: row.id,
    publicId: row.public_id,
    companyId: row.company_id,
    creditLimit: row.credit_limit,
    outstanding: row.outstanding,
    currency: row.currency,
    termsType: row.terms_type as CreditTermsType,
    status: row.status as CompanyCreditAccountSnapshot['status'],
  };
}

// Prisma's Decimal.toString() strips trailing zeros; round-trip through the
// fixed-point helpers to restore the scale-4 string, same fix as every other
// ledger's formatDecimal() in this codebase.
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

/**
 * The company credit ledger (plan/15 Phase 7) — a Wallet mirrored but
 * inverted, same guarded-UPDATE-plus-append-only-ledger discipline as
 * PrismaWalletLedger throughout.
 */
export class PrismaCompanyCreditLedger implements CompanyCreditLedger {
  constructor(private readonly db: Db) {}

  async getOrCreateAccount(companyId: bigint, currency: string, termsType: CreditTermsType = 'NET_30'): Promise<CompanyCreditAccountSnapshot> {
    try {
      const account = await this.db.companyCreditAccount.upsert({
        where: { companyId },
        update: {},
        create: { companyId, currency, termsType },
      });
      return this.toSnapshotFromModel(account);
    } catch (err) {
      // Same lost-the-lazy-create-race fallback as PrismaWalletLedger.getOrCreateWallet.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const account = await this.db.companyCreditAccount.findFirstOrThrow({ where: { companyId } });
        return this.toSnapshotFromModel(account);
      }
      throw err;
    }
  }

  private toSnapshotFromModel(a: {
    id: bigint;
    publicId: string;
    companyId: bigint;
    creditLimit: Prisma.Decimal;
    outstanding: Prisma.Decimal;
    currency: string;
    termsType: CreditTermsType;
    status: string;
  }): CompanyCreditAccountSnapshot {
    return {
      id: a.id,
      publicId: a.publicId,
      companyId: a.companyId,
      creditLimit: formatDecimal(a.creditLimit),
      outstanding: formatDecimal(a.outstanding),
      currency: a.currency,
      termsType: a.termsType,
      status: a.status as CompanyCreditAccountSnapshot['status'],
    };
  }

  async findByCompanyId(companyId: bigint): Promise<CompanyCreditAccountSnapshot | null> {
    const row = await this.db.companyCreditAccount.findFirst({ where: { companyId } });
    return row ? this.toSnapshotFromModel(row) : null;
  }

  async findById(id: bigint): Promise<CompanyCreditAccountSnapshot | null> {
    const row = await this.db.companyCreditAccount.findFirst({ where: { id } });
    return row ? this.toSnapshotFromModel(row) : null;
  }

  async setLimitAndTerms(id: bigint, input: { creditLimit?: string; termsType?: CreditTermsType }): Promise<CompanyCreditAccountSnapshot> {
    const row = await this.db.companyCreditAccount.update({
      where: { id },
      data: { creditLimit: input.creditLimit, termsType: input.termsType, version: { increment: 1 } },
    });
    return this.toSnapshotFromModel(row);
  }

  async freeze(id: bigint): Promise<void> {
    await this.db.companyCreditAccount.update({ where: { id }, data: { status: 'FROZEN' } });
  }

  async unfreeze(id: bigint): Promise<void> {
    await this.db.companyCreditAccount.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async charge(id: bigint, amount: string, opts: CreditLedgerWriteOptions = {}): Promise<CompanyCreditAccountSnapshot> {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<AccountRow[]>`
        UPDATE company_credit_account
           SET outstanding = outstanding + ${amount}::numeric
         WHERE id = ${id} AND (outstanding + ${amount}::numeric) <= credit_limit AND status = 'ACTIVE'
         RETURNING id, public_id, company_id, credit_limit::text, outstanding::text, currency, terms_type::text, status::text`;
      if (rows.length === 0) {
        throw new CreditLimitExceededError(amount);
      }
      const snapshot = rows[0]!;
      const dueAt = computeDueAt(new Date(), snapshot.terms_type as CreditTermsType);
      await tx.$executeRaw`
        INSERT INTO company_credit_transaction
          (credit_account_id, type, amount, outstanding_after, currency, ref_type, ref_id, due_at, idempotency_key, actor_id, reason)
        VALUES
          (${id}, 'CHARGE'::"CompanyCreditTxnType", ${amount}::numeric, ${snapshot.outstanding}::numeric, ${snapshot.currency},
           ${opts.refType ?? null}, ${opts.refId ?? null}, ${dueAt}, ${opts.idempotencyKey ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async reverseCharge(id: bigint, amount: string, opts: CreditLedgerWriteOptions = {}): Promise<CompanyCreditAccountSnapshot> {
    return this.db.$transaction(async (tx) => {
      // Never fails — a compensating reversal (checkout rollback, order
      // cancellation) must always succeed, so this floors at 0 rather than
      // guarding against going negative, mirroring reverseCharge's own
      // "unguarded" contract in the domain interface.
      const rows = await tx.$queryRaw<AccountRow[]>`
        UPDATE company_credit_account
           SET outstanding = GREATEST(outstanding - ${amount}::numeric, 0)
         WHERE id = ${id}
         RETURNING id, public_id, company_id, credit_limit::text, outstanding::text, currency, terms_type::text, status::text`;
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO company_credit_transaction
          (credit_account_id, type, amount, outstanding_after, currency, ref_type, ref_id, idempotency_key, actor_id, reason)
        VALUES
          (${id}, 'WRITE_OFF'::"CompanyCreditTxnType", ${'-' + amount}::numeric, ${snapshot.outstanding}::numeric, ${snapshot.currency},
           ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async recordPayment(id: bigint, amount: string, opts: CreditLedgerWriteOptions = {}): Promise<CompanyCreditAccountSnapshot> {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<AccountRow[]>`
        UPDATE company_credit_account
           SET outstanding = outstanding - ${amount}::numeric
         WHERE id = ${id} AND outstanding >= ${amount}::numeric
         RETURNING id, public_id, company_id, credit_limit::text, outstanding::text, currency, terms_type::text, status::text`;
      if (rows.length === 0) {
        throw new PaymentExceedsOutstandingError(amount);
      }
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO company_credit_transaction
          (credit_account_id, type, amount, outstanding_after, currency, ref_type, ref_id, idempotency_key, actor_id, reason)
        VALUES
          (${id}, 'PAYMENT'::"CompanyCreditTxnType", ${'-' + amount}::numeric, ${snapshot.outstanding}::numeric, ${snapshot.currency},
           ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async adjust(id: bigint, amount: string, opts: CreditLedgerWriteOptions = {}): Promise<CompanyCreditAccountSnapshot> {
    const isCredit = amount.trim().startsWith('-');
    return this.db.$transaction(async (tx) => {
      const rows = isCredit
        ? await tx.$queryRaw<AccountRow[]>`
            UPDATE company_credit_account
               SET outstanding = outstanding + ${amount}::numeric
             WHERE id = ${id} AND (outstanding + ${amount}::numeric) >= 0
             RETURNING id, public_id, company_id, credit_limit::text, outstanding::text, currency, terms_type::text, status::text`
        : await tx.$queryRaw<AccountRow[]>`
            UPDATE company_credit_account
               SET outstanding = outstanding + ${amount}::numeric
             WHERE id = ${id} AND (outstanding + ${amount}::numeric) <= credit_limit
             RETURNING id, public_id, company_id, credit_limit::text, outstanding::text, currency, terms_type::text, status::text`;
      if (rows.length === 0) {
        throw isCredit ? new PaymentExceedsOutstandingError(amount) : new CreditLimitExceededError(amount);
      }
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO company_credit_transaction
          (credit_account_id, type, amount, outstanding_after, currency, ref_type, ref_id, idempotency_key, actor_id, reason)
        VALUES
          (${id}, 'ADJUST'::"CompanyCreditTxnType", ${amount}::numeric, ${snapshot.outstanding}::numeric, ${snapshot.currency},
           ${opts.refType ?? null}, ${opts.refId ?? null}, ${opts.idempotencyKey ?? null}, ${opts.actorId ?? null}, ${opts.reason ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async listTransactions(id: bigint): Promise<CompanyCreditTransactionInfo[]> {
    const rows = await this.db.companyCreditTransaction.findMany({
      where: { creditAccountId: id },
      orderBy: { createdAt: 'desc' },
      select: { type: true, amount: true, outstandingAfter: true, currency: true, refType: true, refId: true, dueAt: true, reason: true, createdAt: true },
    });
    return rows.map((r) => ({
      type: r.type,
      amount: formatDecimal(r.amount),
      outstandingAfter: formatDecimal(r.outstandingAfter),
      currency: r.currency,
      refType: r.refType,
      refId: r.refId,
      dueAt: r.dueAt,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }

  async listOpenInvoices(companyId: bigint): Promise<OpenInvoiceRow[]> {
    // "Open" = the CHARGE's own order hasn't been flipped to PAID (or
    // refunded/cancelled) yet — joined live against `order` rather than
    // tracked as ledger state, since settlement is an Order-level fact
    // (financialStatus), not something the credit ledger itself owns.
    //
    // Joined via order.cart_id, not order.id — a CHARGE's ref_type/ref_id
    // points at the originating Cart, never re-pointed at the Order once one
    // exists, the same StoredValueHold precedent WalletLedger/GiftCardLedger
    // both follow (see company.prisma's header comment).
    const rows = await this.db.$queryRaw<Array<{ order_public_id: string; order_number: bigint; amount: string; currency: string; due_at: Date | null; created_at: Date }>>`
      SELECT o.public_id AS order_public_id, o.order_number, t.amount::text, t.currency, t.due_at, t.created_at
        FROM company_credit_transaction t
        JOIN company_credit_account a ON a.id = t.credit_account_id
        JOIN "order" o ON o.cart_id = t.ref_id AND t.ref_type = 'CART'
       WHERE a.company_id = ${companyId} AND t.type = 'CHARGE' AND o.financial_status = 'ON_ACCOUNT'
       ORDER BY t.due_at ASC NULLS LAST, t.created_at ASC`;
    return rows.map((r) => ({
      orderPublicId: r.order_public_id,
      orderNumber: r.order_number.toString(),
      amountMinor: toMinorUnits(r.amount),
      currency: r.currency,
      dueAt: r.due_at,
      createdAt: r.created_at,
    }));
  }

  async findChargeByRef(refType: string, refId: bigint): Promise<{ accountId: bigint; amount: string } | null> {
    const row = await this.db.companyCreditTransaction.findFirst({
      where: { refType, refId, type: 'CHARGE' },
      orderBy: { createdAt: 'desc' },
      select: { creditAccountId: true, amount: true },
    });
    return row ? { accountId: row.creditAccountId, amount: formatDecimal(row.amount) } : null;
  }
}
