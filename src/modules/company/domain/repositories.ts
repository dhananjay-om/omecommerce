import type { CompanyStatus, CompanyMemberRole, CreditTermsType, CompanyCreditTxnType, WalletStatus } from '@prisma/client';

/** Read-only cross-module lookup: own trivial copy, matching giftcard/loyalty modules' identical-purpose lookup. */
export interface WebsiteLookup {
  byCode(code: string): Promise<{ id: bigint } | null>;
  byId(id: bigint): Promise<{ code: string; baseCurrency: string } | null>;
}

/** Read-only cross-module lookup: own trivial copy, not Customer module's repository. */
export interface CustomerLookup {
  findIdByPublicId(customerPublicId: string): Promise<bigint | null>;
  /** Storefront member-add flow: an ADMIN-role buyer adds an existing registered customer (same website) by email. */
  findByWebsiteAndEmail(websiteId: bigint, email: string): Promise<{ id: bigint; publicId: string } | null>;
  byId(customerId: bigint): Promise<{ publicId: string; email: string; websiteId: bigint } | null>;
}

/** Read-only cross-module lookup: own trivial copy, not Pricing/Order module's repository. */
export interface CustomerGroupLookup {
  byCode(code: string): Promise<{ id: bigint } | null>;
  byId(id: bigint): Promise<{ code: string; name: string } | null>;
}

export interface CompanyRecord {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  code: string;
  name: string;
  status: CompanyStatus;
  customerGroupId: bigint | null;
  taxExempt: boolean;
  taxExemptionRef: string | null;
  gstin: string | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
  billingContactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCompanyInput {
  websiteId: bigint;
  code: string;
  name: string;
  customerGroupId?: bigint | null;
  taxExempt?: boolean;
  taxExemptionRef?: string | null;
  gstin?: string | null;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  billingContactPhone?: string | null;
  createdBy?: bigint;
}

export interface UpdateCompanyInput {
  name?: string;
  customerGroupId?: bigint | null;
  taxExempt?: boolean;
  taxExemptionRef?: string | null;
  gstin?: string | null;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  billingContactPhone?: string | null;
  updatedBy?: bigint;
}

export interface ListCompaniesFilter {
  websiteId?: bigint;
  status?: CompanyStatus;
  /** Matches against code or name, case-insensitive (Citext). */
  q?: string;
  page: number;
  pageSize: number;
}

export interface CompanyListResult {
  total: number;
  companies: CompanyRecord[];
}

export interface CompanyMemberRecord {
  customerId: bigint;
  customerPublicId: string;
  customerEmail: string;
  role: CompanyMemberRole;
  createdAt: Date;
}

export interface CompanyRepository {
  create(input: CreateCompanyInput): Promise<CompanyRecord>;
  findByPublicId(publicId: string): Promise<CompanyRecord | null>;
  findById(id: bigint): Promise<CompanyRecord | null>;
  findByWebsiteAndCode(websiteId: bigint, code: string): Promise<CompanyRecord | null>;
  /** Admin browse (B2B > Companies). Soft-delete-aware, newest first. */
  list(filter: ListCompaniesFilter): Promise<CompanyListResult>;
  update(id: bigint, input: UpdateCompanyInput): Promise<CompanyRecord>;
  setStatus(id: bigint, status: CompanyStatus): Promise<CompanyRecord>;
  softDelete(id: bigint): Promise<void>;

  // Membership (CompanyCustomer.customerId is UNIQUE — one buyer belongs to
  // at most one company; addMember must be called only after the caller has
  // confirmed the target customer has no existing membership).
  addMember(companyId: bigint, customerId: bigint, role: CompanyMemberRole): Promise<CompanyMemberRecord>;
  removeMember(companyId: bigint, customerId: bigint): Promise<void>;
  updateMemberRole(companyId: bigint, customerId: bigint, role: CompanyMemberRole): Promise<CompanyMemberRecord>;
  listMembers(companyId: bigint): Promise<CompanyMemberRecord[]>;
  /** Used both by admin (badge on customer detail) and storefront (/account/company). */
  findMembershipByCustomerId(customerId: bigint): Promise<{ companyId: bigint; role: CompanyMemberRole } | null>;
}

// --- Credit terms (plan/15 Phase 7) ---

export interface CompanyCreditAccountSnapshot {
  id: bigint;
  publicId: string;
  companyId: bigint;
  creditLimit: string;
  outstanding: string;
  currency: string;
  termsType: CreditTermsType;
  status: WalletStatus;
}

export interface CompanyCreditTransactionInfo {
  type: CompanyCreditTxnType;
  amount: string;
  outstandingAfter: string;
  currency: string;
  refType: string | null;
  refId: bigint | null;
  dueAt: Date | null;
  reason: string | null;
  createdAt: Date;
}

export interface CreditLedgerWriteOptions {
  refType?: string;
  refId?: bigint;
  idempotencyKey?: string;
  actorId?: bigint;
  reason?: string;
}

/** One still-open (unsettled) on-account order — the aging report's row shape. */
export interface OpenInvoiceRow {
  orderPublicId: string;
  orderNumber: string;
  amountMinor: bigint;
  currency: string;
  dueAt: Date | null;
  createdAt: Date;
}

/**
 * A company's B2B receivable ledger (plan/15 Phase 7) — a Wallet mirrored but
 * inverted: every mutation is a guarded, atomic UPDATE + an append-only
 * company_credit_transaction insert, the exact same discipline as
 * PrismaWalletLedger. charge()'s guarded UPDATE is what makes concurrent
 * checkouts against the same credit limit race-safe — the same proof shape
 * as the wallet's 10-concurrent-debit test, applied to the opposite sign.
 */
export interface CompanyCreditLedger {
  getOrCreateAccount(companyId: bigint, currency: string, termsType?: CreditTermsType): Promise<CompanyCreditAccountSnapshot>;
  findByCompanyId(companyId: bigint): Promise<CompanyCreditAccountSnapshot | null>;
  findById(id: bigint): Promise<CompanyCreditAccountSnapshot | null>;
  setLimitAndTerms(id: bigint, input: { creditLimit?: string; termsType?: CreditTermsType }): Promise<CompanyCreditAccountSnapshot>;
  freeze(id: bigint): Promise<void>;
  unfreeze(id: bigint): Promise<void>;

  /** Race-safe: throws CreditLimitExceededError if outstanding+amount > creditLimit or status != ACTIVE. dueAt is computed from the account's current termsType and snapshotted onto the CHARGE row. */
  charge(id: bigint, amount: string, opts?: CreditLedgerWriteOptions): Promise<CompanyCreditAccountSnapshot>;
  /** Unguarded compensating reversal (checkout rollback / order cancellation) — writes a WRITE_OFF row; floors outstanding at 0 defensively rather than throwing, since a reversal must never itself fail. */
  reverseCharge(id: bigint, amount: string, opts?: CreditLedgerWriteOptions): Promise<CompanyCreditAccountSnapshot>;
  /** The merchant recording money actually received against the receivable — writes a PAYMENT row. Throws PaymentExceedsOutstandingError if amount > outstanding. */
  recordPayment(id: bigint, amount: string, opts?: CreditLedgerWriteOptions): Promise<CompanyCreditAccountSnapshot>;
  /** Admin correction — signed; a positive amount is guarded against the credit limit exactly like charge(), a negative amount is floored at 0 like reverseCharge(). Writes an ADJUST row. */
  adjust(id: bigint, amount: string, opts?: CreditLedgerWriteOptions): Promise<CompanyCreditAccountSnapshot>;

  listTransactions(id: bigint): Promise<CompanyCreditTransactionInfo[]>;
  /** Every CHARGE whose Order hasn't been flipped to PAID yet — the aging report's source (B2B > Companies > Credit tab, and storefront /account/company/credit). */
  listOpenInvoices(companyId: bigint): Promise<OpenInvoiceRow[]>;
  /** The CHARGE transaction for a given (refType, refId) — e.g. ('CART', order.cartId) — used by RefundOrder/CancelOrder to know how much to reverse. Null if that cart was never charged credit terms. */
  findChargeByRef(refType: string, refId: bigint): Promise<{ accountId: bigint; amount: string } | null>;
}

/**
 * Cross-module write port into the Order module (plan/15 Phase 7 — own copy,
 * per this project's per-module lookup convention, but a mutator rather than
 * a passive read like CompanyMembershipLookup elsewhere). Settlement needs to
 * flip an on-account order to PAID and fire OrderPaid — the same effect
 * CompleteCheckout's own success path has for a normal order, just deferred
 * until the receivable is actually collected.
 */
export interface CompanyOrderSettlement {
  /** Only matches an order that is ON_ACCOUNT and belongs to this company — a settled, cancelled, or otherwise-owned order returns null.
   *  grandTotal lets RecordCompanyCreditPayment validate a recorded payment actually covers every named order before marking them all settled. */
  findSettleableByPublicId(
    companyId: bigint,
    orderPublicId: string,
  ): Promise<{ id: bigint; publicId: string; orderNumber: string; grandTotal: string } | null>;
  markSettled(orderId: bigint): Promise<void>;
}
