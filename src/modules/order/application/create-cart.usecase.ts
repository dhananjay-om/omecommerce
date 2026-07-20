import type { CartRepository, CustomerGroupLookup, CustomerLookup } from '../domain/repositories.js';
import type { StoreContextResolver } from '../../../shared/application/scope.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CreateCartCommand, CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

export class CreateCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly storeContext: StoreContextResolver,
    private readonly customerGroups: CustomerGroupLookup,
    private readonly customers: CustomerLookup,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cmd: CreateCartCommand): Promise<CartView> {
    if (!/^\d+$/.test(cmd.storeViewId)) {
      throw new ValidationError('invalid storeViewId', [{ path: 'storeViewId', message: 'numeric' }]);
    }
    const ctx = await this.storeContext.byStoreViewId(BigInt(cmd.storeViewId));
    if (!ctx) throw new NotFoundError('StoreView', cmd.storeViewId);

    let customerGroupId: bigint | null = null;
    if (cmd.customerGroupCode) {
      const group = await this.customerGroups.byCode(cmd.customerGroupCode);
      if (!group) throw new NotFoundError('CustomerGroup', cmd.customerGroupCode);
      customerGroupId = group.id;
    }

    let customerId: bigint | null = null;
    if (cmd.customerPublicId) {
      customerId = await this.customers.findIdByPublicId(cmd.customerPublicId);
      if (!customerId) throw new NotFoundError('customer', cmd.customerPublicId);
    }

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
