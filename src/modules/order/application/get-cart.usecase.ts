import type { CartRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toDto } from './create-cart.usecase.js';
import type { CartView } from './dto.js';

/** Storefront cart read (plan/14 Phase 0d) — previously missing entirely, so cart state couldn't survive a page reload. */
export class GetCart {
  constructor(private readonly carts: CartRepository) {}

  async execute(cartPublicId: string): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cartPublicId);
    return toDto(cart);
  }
}
