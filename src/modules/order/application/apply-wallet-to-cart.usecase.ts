import type { CartRepository, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

/**
 * requireCustomer + ownership-checked (plan/15 Phase 5) — unlike gift cards,
 * a wallet tender has no separate bearer secret to trust, so it's gated on
 * the caller's own session matching the cart's customerId. A cart tender is
 * a singleton per cart (CartTender's NULLS NOT DISTINCT unique index), so
 * re-applying is a no-op.
 */
export class ApplyWalletToCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly customers: CustomerLookup,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cmd: { cartPublicId: string; customerPublicId: string }): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);

    const customerId = await this.customers.findIdByPublicId(cmd.customerPublicId);
    if (!customerId) throw new NotFoundError('customer', cmd.customerPublicId);
    if (cart.customerId !== customerId) {
      throw new ValidationError('cart does not belong to this customer', [{ path: 'cartPublicId', message: 'ownership mismatch' }]);
    }

    await this.carts.addTender(cart.id, 'WALLET', null);
    const updated = await this.carts.findByPublicId(cmd.cartPublicId);
    return this.enrichCartView.execute(updated!);
  }
}
