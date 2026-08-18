import type { CartRepository, CustomerGroupLookup, CustomerLookup, CompanyMembershipLookup } from '../domain/repositories.js';
import type { StoreContextResolver } from '../../../shared/application/scope.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CreateCartCommand, CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';
import { resolveCustomerGroupId } from './resolve-customer-group.js';

/**
 * plan/15 Phase 6 — no longer accepts a client-supplied group; the pricing
 * group is always server-derived via resolveCustomerGroupId() (company
 * membership -> customer's own group -> website default -> null for
 * guests). See that function's doc comment for the full rationale.
 */
export class CreateCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly storeContext: StoreContextResolver,
    private readonly customerGroups: CustomerGroupLookup,
    private readonly customers: CustomerLookup,
    private readonly companyMemberships: CompanyMembershipLookup,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cmd: CreateCartCommand): Promise<CartView> {
    if (!/^\d+$/.test(cmd.storeViewId)) {
      throw new ValidationError('invalid storeViewId', [{ path: 'storeViewId', message: 'numeric' }]);
    }
    const ctx = await this.storeContext.byStoreViewId(BigInt(cmd.storeViewId));
    if (!ctx) throw new NotFoundError('StoreView', cmd.storeViewId);

    let customerId: bigint | null = null;
    if (cmd.customerPublicId) {
      customerId = await this.customers.findIdByPublicId(cmd.customerPublicId);
      if (!customerId) throw new NotFoundError('customer', cmd.customerPublicId);
    }

    const customerGroupId = await resolveCustomerGroupId(customerId, this.companyMemberships, this.customers, this.customerGroups);

    const cart = await this.carts.create({
      websiteId: ctx.websiteId,
      storeViewId: ctx.storeViewId,
      currency: ctx.currency,
      customerId,
      customerGroupId,
    });
    return this.enrichCartView.execute(cart);
  }
}
