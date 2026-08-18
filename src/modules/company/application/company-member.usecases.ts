import type { CompanyMemberRole } from '@prisma/client';
import type { CompanyRepository, CustomerLookup } from '../domain/repositories.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import type { CompanyMemberView, AddCompanyMemberCommand } from './dto.js';

function toMemberView(m: { customerPublicId: string; customerEmail: string; role: CompanyMemberRole; createdAt: Date }): CompanyMemberView {
  return { customerPublicId: m.customerPublicId, email: m.customerEmail, role: m.role, createdAt: m.createdAt.toISOString() };
}

/** Admin member management (B2B > Companies > detail > Members tab), keyed directly by companyPublicId — trusted since the route is already permission-gated on `company:manage`. */
export class ListCompanyMembers {
  constructor(private readonly companies: CompanyRepository) {}

  async execute(companyPublicId: string): Promise<CompanyMemberView[]> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const rows = await this.companies.listMembers(company.id);
    return rows.map(toMemberView);
  }
}

export class AddCompanyMember {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(companyPublicId: string, cmd: AddCompanyMemberCommand): Promise<CompanyMemberView> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);

    const customer = await this.customers.findByWebsiteAndEmail(company.websiteId, cmd.email);
    if (!customer) throw new NotFoundError('customer', cmd.email);

    if (await this.companies.findMembershipByCustomerId(customer.id)) {
      throw new ConflictError('this customer already belongs to a company');
    }

    const member = await this.companies.addMember(company.id, customer.id, cmd.role ?? 'BUYER');
    return toMemberView(member);
  }
}

export class RemoveCompanyMember {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(companyPublicId: string, customerPublicId: string): Promise<void> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);
    await this.companies.removeMember(company.id, customerId);
  }
}

export class UpdateCompanyMemberRole {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(companyPublicId: string, customerPublicId: string, role: CompanyMemberRole): Promise<CompanyMemberView> {
    const company = await this.companies.findByPublicId(companyPublicId);
    if (!company) throw new NotFoundError('company', companyPublicId);
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);
    const member = await this.companies.updateMemberRole(company.id, customerId, role);
    return toMemberView(member);
  }
}
