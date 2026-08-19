export type CompanyStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type CompanyMemberRole = 'ADMIN' | 'BUYER';

export interface Company {
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

/** null `company` means the signed-in customer isn't a member of any (a perfectly normal state, not an error). */
export interface MyCompany {
  company: Company | null;
  myRole: CompanyMemberRole | null;
}

export interface CompanyMember {
  customerPublicId: string;
  email: string;
  role: CompanyMemberRole;
  createdAt: string;
}

// --- Credit terms (plan/15 Phase 7) ---

export type CreditTermsType = 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60';

export interface CompanyCreditAccount {
  publicId: string;
  creditLimit: string;
  outstanding: string;
  /** creditLimit - outstanding — never negative. */
  available: string;
  currency: string;
  termsType: CreditTermsType;
  status: 'ACTIVE' | 'FROZEN';
}

export type AgingBucketLabel = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export interface OpenInvoice {
  orderPublicId: string;
  orderNumber: string;
  amount: string;
  currency: string;
  dueAt: string | null;
  createdAt: string;
  daysOverdue: number;
  bucket: AgingBucketLabel;
}

/** null `account` means no credit terms are configured for this customer's company — a normal state (not every B2B company has Net-X terms), same as MyCompany's null-company case. */
export interface MyCompanyCredit {
  account: CompanyCreditAccount | null;
  openInvoices: OpenInvoice[];
}
