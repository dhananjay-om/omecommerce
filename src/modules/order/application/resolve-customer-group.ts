import type { CustomerGroupLookup, CustomerLookup, CompanyMembershipLookup } from '../domain/repositories.js';

/**
 * plan/15 Phase 6 — the single source of truth for "what pricing/tax group
 * does this cart get", replacing the old client-supplied `customerGroupCode`
 * CreateCart used to trust blindly (removed from the schema entirely — zero
 * real callers ever sent it, confirmed by a repo-wide grep, so this is a
 * free breaking-API-change fix).
 *
 * Precedence, most specific first:
 *   1. An ACTIVE company membership's own CustomerGroup (B2B pricing wins).
 *   2. The customer's own (pre-B2B) CustomerGroup assignment.
 *   3. The website-wide default CustomerGroup, if one is configured.
 *   4. null (guest, or no default configured — falls back to base pricing).
 *
 * Shared by CreateCart (cart creation) and AttachCustomerToCart (guest cart
 * claimed at login) — both need the exact same resolution, not two
 * independently-drifting copies.
 */
export async function resolveCustomerGroupId(
  customerId: bigint | null,
  companyMemberships: CompanyMembershipLookup,
  customers: CustomerLookup,
  customerGroups: CustomerGroupLookup,
): Promise<bigint | null> {
  if (customerId) {
    const membership = await companyMemberships.findActiveByCustomerId(customerId);
    if (membership?.customerGroupId) return membership.customerGroupId;

    const ownGroupId = await customers.findGroupIdByCustomerId(customerId);
    if (ownGroupId) return ownGroupId;
  }

  const defaultGroup = await customerGroups.findDefault();
  return defaultGroup?.id ?? null;
}
