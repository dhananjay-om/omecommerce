import type { CreditTermsType, WalletStatus } from '@prisma/client';
import type { CompanyRepository, WebsiteLookup, CustomerLookup, CompanyCreditLedger, CompanyOrderSettlement, OpenInvoiceRow } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { fromMinorUnits, toMinorUnits, subtractMinor } from '../../../shared/domain/decimal.js';
import type {
  SetCompanyCreditTermsCommand,
  CompanyCreditAccountView,
  CompanyCreditTransactionView,
  AgingReportView,
  OpenInvoiceView,
  AgingBucketLabel,
  RecordCompanyCreditPaymentCommand,
  AdjustCompanyCreditCommand,
} from './dto.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toAccountView(a: { publicId: string; creditLimit: string; outstanding: string; currency: string; termsType: CreditTermsType; status: WalletStatus }): CompanyCreditAccountView {
  const availableMinor = subtractMinor(toMinorUnits(a.creditLimit), toMinorUnits(a.outstanding));
  return {
    publicId: a.publicId,
    creditLimit: a.creditLimit,
    outstanding: a.outstanding,
    available: fromMinorUnits(availableMinor),
    currency: a.currency,
    termsType: a.termsType,
    status: a.status,
  };
}

function bucketFor(daysOverdue: number): AgingBucketLabel {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

function toOpenInvoiceView(row: OpenInvoiceRow, now: number): OpenInvoiceView {
  const daysOverdue = row.dueAt ? Math.max(0, Math.floor((now - row.dueAt.getTime()) / MS_PER_DAY)) : 0;
  return {
    orderPublicId: row.orderPublicId,
    orderNumber: row.orderNumber,
    amount: fromMinorUnits(row.amountMinor),
    currency: row.currency,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    daysOverdue,
    bucket: bucketFor(daysOverdue),
  };
}

/** Admin sets or updates a company's credit limit and/or terms — creates the account (defaulting to the company's website's base currency) the first time this is called for a company. */
export class SetCompanyCreditTerms {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly websites: WebsiteLookup,
    private readonly creditLedger: CompanyCreditLedger,
  ) {}

  async execute(companyPublicId: string, cmd: SetCompanyCreditTermsCommand): Promise<CompanyCreditAccountView> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    if (cmd.creditLimit !== undefined && toMinorUnits(cmd.creditLimit) < 0n) {
      throw new ValidationError('creditLimit must not be negative', [{ path: 'creditLimit', message: 'must be >= 0' }]);
    }

    let account = await this.creditLedger.findByCompanyId(company.id);
    if (!account) {
      const website = await this.websites.byId(company.websiteId);
      account = await this.creditLedger.getOrCreateAccount(company.id, website?.baseCurrency ?? 'USD', cmd.termsType);
    }

    // Mirrors the DB's own outstanding_le_limit CHECK — surfaced here as a
    // friendly 422 instead of a raw constraint violation, same discipline as
    // Phase 6's validateTaxExemptShape().
    if (cmd.creditLimit !== undefined && toMinorUnits(cmd.creditLimit) < toMinorUnits(account.outstanding)) {
      throw new ValidationError(`creditLimit can't be set below the current outstanding balance (${account.outstanding})`, [
        { path: 'creditLimit', message: 'below outstanding' },
      ]);
    }

    const updated = await this.creditLedger.setLimitAndTerms(account.id, { creditLimit: cmd.creditLimit, termsType: cmd.termsType });
    return toAccountView(updated);
  }
}

/** Admin/storefront read — null means this company has no credit account configured yet (Net-X terms were never set up for it). */
export class GetCompanyCreditAccount {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly creditLedger: CompanyCreditLedger,
  ) {}

  async execute(companyPublicId: string): Promise<CompanyCreditAccountView | null> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const account = await this.creditLedger.findByCompanyId(company.id);
    return account ? toAccountView(account) : null;
  }
}

export class ListCompanyCreditTransactions {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly creditLedger: CompanyCreditLedger,
  ) {}

  async execute(companyPublicId: string): Promise<CompanyCreditTransactionView[]> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const account = await this.creditLedger.findByCompanyId(company.id);
    if (!account) return [];
    const rows = await this.creditLedger.listTransactions(account.id);
    return rows.map((r) => ({
      type: r.type,
      amount: r.amount,
      outstandingAfter: r.outstandingAfter,
      currency: r.currency,
      dueAt: r.dueAt?.toISOString() ?? null,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

/** Admin B2B > Companies > Credit tab's aging table — every still-open on-account order, bucketed by days past due. */
export class GetCompanyAgingReport {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly creditLedger: CompanyCreditLedger,
  ) {}

  async execute(companyPublicId: string): Promise<AgingReportView> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const rows = await this.creditLedger.listOpenInvoices(company.id);
    const now = Date.now();
    const bucketTotalsMinor: Record<AgingBucketLabel, bigint> = { current: 0n, '1-30': 0n, '31-60': 0n, '61-90': 0n, '90+': 0n };
    const invoices = rows.map((r) => {
      const view = toOpenInvoiceView(r, now);
      bucketTotalsMinor[view.bucket] += r.amountMinor;
      return view;
    });
    const buckets = Object.fromEntries(
      (Object.entries(bucketTotalsMinor) as Array<[AgingBucketLabel, bigint]>).map(([label, minor]) => [label, fromMinorUnits(minor)]),
    ) as Record<AgingBucketLabel, string>;
    return { buckets, invoices };
  }
}

/**
 * The merchant recording money actually received against the receivable —
 * plan/15 Phase 7's settlement step. Every named order must currently be
 * ON_ACCOUNT and belong to this company (validated up front, before any
 * write happens) — a typo'd or already-settled order publicId rejects the
 * whole request rather than silently recording money against nothing.
 */
export class RecordCompanyCreditPayment {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly creditLedger: CompanyCreditLedger,
    private readonly settlement: CompanyOrderSettlement,
  ) {}

  async execute(companyPublicId: string, cmd: RecordCompanyCreditPaymentCommand, actorId?: bigint): Promise<CompanyCreditAccountView> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const account = await this.creditLedger.findByCompanyId(company.id);
    if (!account) throw new NotFoundError('company credit account', companyPublicId);
    if (cmd.orderPublicIds.length === 0) {
      throw new ValidationError('at least one order must be named', [{ path: 'orderPublicIds', message: 'required' }]);
    }

    const orders = [];
    for (const orderPublicId of cmd.orderPublicIds) {
      const order = await this.settlement.findSettleableByPublicId(company.id, orderPublicId);
      if (!order) throw new NotFoundError('on-account order', orderPublicId);
      orders.push(order);
    }

    const updated = await this.creditLedger.recordPayment(account.id, cmd.amount, { reason: cmd.reason, actorId });
    for (const order of orders) {
      await this.settlement.markSettled(order.id);
    }
    return toAccountView(updated);
  }
}

/** Admin manual correction — a positive amount increases what's owed (guarded against the credit limit), a negative amount decreases it (floored at 0). */
export class AdjustCompanyCredit {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly creditLedger: CompanyCreditLedger,
  ) {}

  async execute(companyPublicId: string, cmd: AdjustCompanyCreditCommand, actorId?: bigint): Promise<CompanyCreditAccountView> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const account = await this.creditLedger.findByCompanyId(company.id);
    if (!account) throw new NotFoundError('company credit account', companyPublicId);
    const updated = await this.creditLedger.adjust(account.id, cmd.amount, { reason: cmd.reason, actorId });
    return toAccountView(updated);
  }
}

/** Freezing blocks further CHARGEs (a company with a billing dispute) — PAYMENT/ADJUST/WRITE_OFF still work while frozen, mirroring Wallet's freeze semantics for debits vs credits. */
export class SetCompanyCreditAccountStatus {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly creditLedger: CompanyCreditLedger,
  ) {}

  async execute(companyPublicId: string, status: 'ACTIVE' | 'FROZEN'): Promise<CompanyCreditAccountView> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const account = await this.creditLedger.findByCompanyId(company.id);
    if (!account) throw new NotFoundError('company credit account', companyPublicId);
    if (status === 'FROZEN') await this.creditLedger.freeze(account.id);
    else await this.creditLedger.unfreeze(account.id);
    const updated = await this.creditLedger.findById(account.id);
    return toAccountView(updated!);
  }
}

/** Storefront /account/company/credit — a non-member, a member of a not-yet-Active company, or a company with no credit account configured all resolve to `{ account: null, openInvoices: [] }` rather than an error (every one of these is a normal state, not a broken one). */
export class GetMyCompanyCredit {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
    private readonly creditLedger: CompanyCreditLedger,
  ) {}

  async execute(customerPublicId: string): Promise<{ account: CompanyCreditAccountView | null; openInvoices: OpenInvoiceView[] }> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);
    const membership = await this.companies.findMembershipByCustomerId(customerId);
    if (!membership) return { account: null, openInvoices: [] };
    const company = await this.companies.findById(membership.companyId);
    if (!company || company.status !== 'ACTIVE') return { account: null, openInvoices: [] };
    const account = await this.creditLedger.findByCompanyId(company.id);
    if (!account) return { account: null, openInvoices: [] };

    const rows = await this.creditLedger.listOpenInvoices(company.id);
    const now = Date.now();
    return { account: toAccountView(account), openInvoices: rows.map((r) => toOpenInvoiceView(r, now)) };
  }
}
