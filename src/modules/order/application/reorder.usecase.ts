import type { OrderRepository, CustomerLookup, VariantLookup, CartRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { ReorderResultDto } from './dto.js';

/**
 * plan/15 Phase 11 — "Reorder" adds every line from a past order back into a
 * FRESH cart (not a merge into whatever cart the customer already has —
 * simpler semantics, and the caller sets its cart cookie to the returned
 * cart, replacing the old one). Lines whose variant no longer exists or is
 * INACTIVE are skipped and reported, never silently dropped.
 */
export class Reorder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly customers: CustomerLookup,
    private readonly variants: VariantLookup,
    private readonly carts: CartRepository,
  ) {}

  async execute(customerPublicId: string, orderPublicId: string): Promise<ReorderResultDto> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);

    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order || order.customerId !== customerId) throw new NotFoundError('Order', orderPublicId);

    const cart = await this.carts.create({
      websiteId: order.websiteId,
      storeViewId: order.storeViewId,
      currency: order.currency,
      customerId,
    });

    const skipped: ReorderResultDto['skipped'] = [];
    for (const line of order.lines) {
      const variant = await this.variants.byId(line.variantId);
      if (!variant || variant.status !== 'ACTIVE') {
        skipped.push({ sku: line.sku, name: line.name, reason: variant ? 'no longer available' : 'no longer exists' });
        continue;
      }
      await this.carts.upsertLine(cart.id, line.variantId, line.qty);
    }

    return { cartPublicId: cart.publicId, skipped };
  }
}
