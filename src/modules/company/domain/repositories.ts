import type { CompanyStatus, CompanyMemberRole } from '@prisma/client';

/** Read-only cross-module lookup: own trivial copy, matching giftcard/loyalty modules' identical-purpose lookup. */
export interface WebsiteLookup {
  byCode(code: string): Promise<{ id: bigint } | null>;
  byId(id: bigint): Promise<{ code: string } | null>;
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
