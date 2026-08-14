import type { CartRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

export class RemoveCouponFromCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cmd: { cartPublicId: string }): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);

    await this.carts.setCouponCode(cart.id, null);
    const updated = await this.carts.findByPublicId(cmd.cartPublicId);
    return this.enrichCartView.execute(updated!);
  }
}
