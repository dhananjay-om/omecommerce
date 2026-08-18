import type { CartRepository, CustomerGroupLookup, CustomerLookup, CompanyMembershipLookup } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import type { CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';
import { resolveCustomerGroupId } from './resolve-customer-group.js';

/**
 * plan/15 Phase 6 — claims a guest cart at login and re-derives its pricing
 * group, closing the gap CreateCart's fix alone doesn't: today the group is
 * only ever set at cart *creation*, so a shopper who fills a cart before
 * signing in (or signs in from a different device than where the cart was
 * created) silently keeps retail pricing forever. Called by the storefront
 * login route with the existing guest cart cookie's id; failures are
 * expected to be swallowed there (a bad/expired cart must never block
 * login), same non-fatal-attach precedent as referral-code-attach.
 */
export class AttachCustomerToCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly customerGroups: CustomerGroupLookup,
    private readonly customers: CustomerLookup,
    private readonly companyMemberships: CompanyMembershipLookup,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cartPublicId: string, customerPublicId: string): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cartPublicId);
    if (!cart) throw new NotFoundError('cart', cartPublicId);

    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);

    if (cart.customerId && cart.customerId !== customerId) {
      throw new ConflictError('this cart already belongs to a different customer');
    }

    // Already attached to this same customer (e.g. a page refresh re-firing
    // the login flow) — re-resolving is harmless but pointless, skip it.
    if (cart.customerId !== customerId) {
      const customerGroupId = await resolveCustomerGroupId(customerId, this.companyMemberships, this.customers, this.customerGroups);
      await this.carts.attachCustomer(cart.id, customerId, customerGroupId);
    }

    const updated = await this.carts.findByPublicId(cartPublicId);
    return this.enrichCartView.execute(updated!);
  }
}
