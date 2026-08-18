import type { CompanyMemberRole } from '@prisma/client';
import type { CompanyRepository, CustomerLookup, WebsiteLookup, CustomerGroupLookup } from '../domain/repositories.js';
import { DomainError, NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import type { MyCompanyView, CompanyMemberView, AddCompanyMemberCommand } from './dto.js';
import { toCompanyView } from './to-company-view.js';

function toMemberView(m: { customerPublicId: string; customerEmail: string; role: CompanyMemberRole; createdAt: Date }): CompanyMemberView {
  return { customerPublicId: m.customerPublicId, email: m.customerEmail, role: m.role, createdAt: m.createdAt.toISOString() };
}

/** Resolves the signed-in customer's own company membership, or throws — shared entry point for every /account/company storefront usecase below. */
async function requireMembership(customers: CustomerLookup, companies: CompanyRepository, customerPublicId: string) {
  const customerId = await customers.findIdByPublicId(customerPublicId);
  if (!customerId) throw new NotFoundError('customer', customerPublicId);
  const membership = await companies.findMembershipByCustomerId(customerId);
  if (!membership) throw new NotFoundError('company membership', customerPublicId);
  const company = await companies.findById(membership.companyId);
  if (!company) throw new NotFoundError('company', String(membership.companyId));
  return { customerId, role: membership.role, company };
}

/** Storefront read-only company info (plan/15 Phase 6) — a customer with no company membership sees `{ company: null }`, not a 404 (viewing the account page is always valid, having a company isn't). */
export class GetMyCompany {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
    private readonly websites: WebsiteLookup,
    private readonly customerGroups: CustomerGroupLookup,
  ) {}

  async execute(customerPublicId: string): Promise<MyCompanyView> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);
    const membership = await this.companies.findMembershipByCustomerId(customerId);
    if (!membership) return { company: null, myRole: null };
    const company = await this.companies.findById(membership.companyId);
    if (!company) return { company: null, myRole: null };
    return { company: await toCompanyView(company, this.websites, this.customerGroups), myRole: membership.role };
  }
}

export class ListMyCompanyMembers {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(customerPublicId: string): Promise<CompanyMemberView[]> {
    const { company } = await requireMembership(this.customers, this.companies, customerPublicId);
    const rows = await this.companies.listMembers(company.id);
    return rows.map(toMemberView);
  }
}

/** Only an ADMIN-role member of an ACTIVE company can manage its buyer list (plan/15 Phase 6 — "role ADMIN can manage the company's buyer list, BUYER can only shop"). */
function requireCompanyAdmin(role: CompanyMemberRole, companyStatus: string): void {
  if (role !== 'ADMIN') throw new DomainError('only a company ADMIN can manage members', 'https://errors.ome/forbidden', 403);
  if (companyStatus !== 'ACTIVE') throw new DomainError('this company is not active', 'https://errors.ome/company-not-active', 409);
}

export class AddMyCompanyMember {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(customerPublicId: string, cmd: AddCompanyMemberCommand): Promise<CompanyMemberView> {
    const { role, company } = await requireMembership(this.customers, this.companies, customerPublicId);
    requireCompanyAdmin(role, company.status);

    const target = await this.customers.findByWebsiteAndEmail(company.websiteId, cmd.email);
    if (!target) throw new NotFoundError('customer', cmd.email);
    if (await this.companies.findMembershipByCustomerId(target.id)) {
      throw new ConflictError('this customer already belongs to a company');
    }
    const member = await this.companies.addMember(company.id, target.id, cmd.role ?? 'BUYER');
    return toMemberView(member);
  }
}

export class RemoveMyCompanyMember {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(customerPublicId: string, targetCustomerPublicId: string): Promise<void> {
    const { role, company } = await requireMembership(this.customers, this.companies, customerPublicId);
    requireCompanyAdmin(role, company.status);
    const targetId = await this.customers.findIdByPublicId(targetCustomerPublicId);
    if (!targetId) throw new NotFoundError('customer', targetCustomerPublicId);
    await this.companies.removeMember(company.id, targetId);
  }
}

export class UpdateMyCompanyMemberRole {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(customerPublicId: string, targetCustomerPublicId: string, newRole: CompanyMemberRole): Promise<CompanyMemberView> {
    const { role, company } = await requireMembership(this.customers, this.companies, customerPublicId);
    requireCompanyAdmin(role, company.status);
    const targetId = await this.customers.findIdByPublicId(targetCustomerPublicId);
    if (!targetId) throw new NotFoundError('customer', targetCustomerPublicId);
    const member = await this.companies.updateMemberRole(company.id, targetId, newRole);
    return toMemberView(member);
  }
}
