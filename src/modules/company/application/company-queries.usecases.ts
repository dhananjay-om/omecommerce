import type { CompanyStatus } from '@prisma/client';
import type { CompanyRepository, WebsiteLookup, CustomerGroupLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CompanyView, ListCompaniesQuery, CompanyListView, UpdateCompanyCommand } from './dto.js';
import { toCompanyView } from './to-company-view.js';
import { validateTaxExemptShape } from './validate-tax-exempt-shape.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class GetCompany {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly websites: WebsiteLookup,
    private readonly customerGroups: CustomerGroupLookup,
  ) {}

  async execute(publicId: string): Promise<CompanyView> {
    const company = await this.companies.findByPublicId(publicId);
    if (!company) throw new NotFoundError('company', publicId);
    return toCompanyView(company, this.websites, this.customerGroups);
  }
}

/** Admin browse (B2B > Companies). */
export class ListCompanies {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly websites: WebsiteLookup,
  ) {}

  async execute(query: ListCompaniesQuery): Promise<CompanyListView> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    // An unresolvable websiteCode must filter to zero rows, not silently fall
    // back to "no filter" (same reasoning as ListGiftCards).
    let websiteId: bigint | undefined;
    if (query.websiteCode) {
      const website = await this.websites.byCode(query.websiteCode);
      if (!website) return { total: 0, page, pageSize, companies: [] };
      websiteId = website.id;
    }
    const result = await this.companies.list({ websiteId, status: query.status, q: query.q, page, pageSize });
    return {
      total: result.total,
      page,
      pageSize,
      companies: result.companies.map((c) => ({
        publicId: c.publicId,
        code: c.code,
        name: c.name,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }
}

export class UpdateCompany {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly websites: WebsiteLookup,
    private readonly customerGroups: CustomerGroupLookup,
  ) {}

  async execute(publicId: string, cmd: UpdateCompanyCommand, actorId?: bigint): Promise<CompanyView> {
    const company = await this.companies.findByPublicId(publicId);
    if (!company) throw new NotFoundError('company', publicId);

    // Merged-with-current-state check, same "only re-validate what the patch
    // actually affects, against the merged result" discipline as
    // UpdateReferralProgram's reward-shape re-check.
    const effectiveTaxExempt = cmd.taxExempt ?? company.taxExempt;
    const effectiveTaxExemptionRef = cmd.taxExemptionRef !== undefined ? cmd.taxExemptionRef : company.taxExemptionRef;
    validateTaxExemptShape(effectiveTaxExempt, effectiveTaxExemptionRef);

    let customerGroupId: bigint | null | undefined;
    if (cmd.customerGroupCode === null) {
      customerGroupId = null;
    } else if (cmd.customerGroupCode) {
      const group = await this.customerGroups.byCode(cmd.customerGroupCode);
      if (!group) throw new NotFoundError('CustomerGroup', cmd.customerGroupCode);
      customerGroupId = group.id;
    }

    const updated = await this.companies.update(company.id, {
      name: cmd.name,
      customerGroupId,
      taxExempt: cmd.taxExempt,
      taxExemptionRef: cmd.taxExemptionRef,
      gstin: cmd.gstin,
      billingContactName: cmd.billingContactName,
      billingContactEmail: cmd.billingContactEmail,
      billingContactPhone: cmd.billingContactPhone,
      updatedBy: actorId,
    });
    return toCompanyView(updated, this.websites, this.customerGroups);
  }
}

/** Admin approve/suspend/reject actions (B2B > Companies detail page). Any PENDING/SUSPENDED/REJECTED company can be moved to ACTIVE by re-approval — a prior rejection or suspension isn't a dead end. */
export class SetCompanyStatus {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly websites: WebsiteLookup,
    private readonly customerGroups: CustomerGroupLookup,
  ) {}

  async execute(publicId: string, status: CompanyStatus): Promise<CompanyView> {
    const company = await this.companies.findByPublicId(publicId);
    if (!company) throw new NotFoundError('company', publicId);
    const updated = await this.companies.setStatus(company.id, status);
    return toCompanyView(updated, this.websites, this.customerGroups);
  }
}
