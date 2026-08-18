import type { CompanyStatus, CompanyMemberRole } from '@prisma/client';

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
