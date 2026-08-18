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
