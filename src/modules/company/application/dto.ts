import type { CompanyStatus, CompanyMemberRole, CreditTermsType, CompanyCreditTxnType, WalletStatus } from '@prisma/client';

export interface CreateCompanyCommand {
  websiteCode: string;
  code: string;
  name: string;
  customerGroupCode?: string | null;
  taxExempt?: boolean;
  taxExemptionRef?: string | null;
  gstin?: string | null;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  billingContactPhone?: string | null;
}

export interface UpdateCompanyCommand {
  name?: string;
  customerGroupCode?: string | null;
  taxExempt?: boolean;
  taxExemptionRef?: string | null;
  gstin?: string | null;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  billingContactPhone?: string | null;
}

export interface CompanyView {
  publicId: string;
  websiteCode: string;
  code: string;
  name: string;
  status: CompanyStatus;
  customerGroupCode: string | null;
  customerGroupName: string | null;
  taxExempt: boolean;
  taxExemptionRef: string | null;
  gstin: string | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
  billingContactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListCompaniesQuery {
  websiteCode?: string;
  status?: CompanyStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CompanyListRowView {
  publicId: string;
  code: string;
  name: string;
  status: CompanyStatus;
  createdAt: string;
}

export interface CompanyListView {
  total: number;
  page: number;
  pageSize: number;
  companies: CompanyListRowView[];
}

export interface CompanyMemberView {
  customerPublicId: string;
  email: string;
  role: CompanyMemberRole;
  createdAt: string;
}

export interface AddCompanyMemberCommand {
  email: string;
  role?: CompanyMemberRole;
}

/** Storefront /account/company — null company means the customer isn't a member of any. */
export interface MyCompanyView {
  company: CompanyView | null;
  myRole: CompanyMemberRole | null;
}

// --- Credit terms (plan/15 Phase 7) ---

export interface SetCompanyCreditTermsCommand {
  creditLimit?: string;
  termsType?: CreditTermsType;
}

export interface CompanyCreditAccountView {
  publicId: string;
  creditLimit: string;
  outstanding: string;
  /** creditLimit - outstanding — never negative (the guarded charge() UPDATE can't let outstanding exceed creditLimit). */
  available: string;
  currency: string;
  termsType: CreditTermsType;
  status: WalletStatus;
}

export interface CompanyCreditTransactionView {
  type: CompanyCreditTxnType;
  amount: string;
  outstandingAfter: string;
  currency: string;
  dueAt: string | null;
  reason: string | null;
  createdAt: string;
}

export type AgingBucketLabel = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export interface OpenInvoiceView {
  orderPublicId: string;
  orderNumber: string;
  amount: string;
  currency: string;
  dueAt: string | null;
  createdAt: string;
  /** Days past dueAt, 0 if not yet due or no dueAt was ever set. */
  daysOverdue: number;
  bucket: AgingBucketLabel;
}

export interface AgingReportView {
  buckets: Record<AgingBucketLabel, string>;
  invoices: OpenInvoiceView[];
}

export interface RecordCompanyCreditPaymentCommand {
  amount: string;
  reason?: string;
  /** Which open invoices this payment settles — each is flipped to PAID and fires OrderPaid. Orders not currently ON_ACCOUNT (or not this company's) are rejected individually, not silently skipped. */
  orderPublicIds: string[];
}

export interface AdjustCompanyCreditCommand {
  amount: string;
  reason: string;
}
