import type { CompanyRepository, WebsiteLookup, CustomerGroupLookup } from '../domain/repositories.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import type { CreateCompanyCommand, CompanyView } from './dto.js';
import { toCompanyView } from './to-company-view.js';
import { validateTaxExemptShape } from './validate-tax-exempt-shape.js';

export class CreateCompany {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly websites: WebsiteLookup,
    private readonly customerGroups: CustomerGroupLookup,
  ) {}

  async execute(cmd: CreateCompanyCommand, actorId?: bigint): Promise<CompanyView> {
    validateTaxExemptShape(cmd.taxExempt ?? false, cmd.taxExemptionRef);

    const website = await this.websites.byCode(cmd.websiteCode);
    if (!website) throw new NotFoundError('website', cmd.websiteCode);

    if (await this.companies.findByWebsiteAndCode(website.id, cmd.code)) {
      throw new ConflictError(`a company with code "${cmd.code}" already exists for this website`);
    }

    let customerGroupId: bigint | null = null;
    if (cmd.customerGroupCode) {
      const group = await this.customerGroups.byCode(cmd.customerGroupCode);
      if (!group) throw new NotFoundError('CustomerGroup', cmd.customerGroupCode);
      customerGroupId = group.id;
    }

    const company = await this.companies.create({
      websiteId: website.id,
      code: cmd.code,
      name: cmd.name,
      customerGroupId,
      taxExempt: cmd.taxExempt,
      taxExemptionRef: cmd.taxExemptionRef,
      gstin: cmd.gstin,
      billingContactName: cmd.billingContactName,
      billingContactEmail: cmd.billingContactEmail,
      billingContactPhone: cmd.billingContactPhone,
      createdBy: actorId,
    });
    return toCompanyView(company, this.websites, this.customerGroups);
  }
}
