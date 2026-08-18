import type { CompanyRecord, WebsiteLookup, CustomerGroupLookup } from '../domain/repositories.js';
import type { CompanyView } from './dto.js';

/** Shared record->view mapping — resolves websiteId/customerGroupId back to their public codes/names, same composition pattern as loyalty-program-queries.usecases.ts's toView(). */
export async function toCompanyView(c: CompanyRecord, websites: WebsiteLookup, customerGroups: CustomerGroupLookup): Promise<CompanyView> {
  const website = await websites.byId(c.websiteId);
  const group = c.customerGroupId ? await customerGroups.byId(c.customerGroupId) : null;
  return {
    publicId: c.publicId,
    websiteCode: website?.code ?? '',
    code: c.code,
    name: c.name,
    status: c.status,
    customerGroupCode: group?.code ?? null,
    customerGroupName: group?.name ?? null,
    taxExempt: c.taxExempt,
    taxExemptionRef: c.taxExemptionRef,
    gstin: c.gstin,
    billingContactName: c.billingContactName,
    billingContactEmail: c.billingContactEmail,
    billingContactPhone: c.billingContactPhone,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
