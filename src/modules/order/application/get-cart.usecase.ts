import type { CartRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

/** Storefront cart read (plan/14 Phase 0d) — previously missing entirely, so cart state couldn't survive a page reload. */
export class GetCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cartPublicId: string): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cartPublicId);
    return this.enrichCartView.execute(cart);
  }
}
