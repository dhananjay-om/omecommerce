import type { CartRepository, VariantLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toDto } from './create-cart.usecase.js';
import type { RemoveCartLineCommand, CartView } from './dto.js';

/**
 * Storefront cart line removal (plan/14 Phase 0d) — previously missing
 * entirely; `CartRepository.upsertLine` already treats qty<=0 as "remove"
 * (used internally), but `POST /carts/:id/lines`'s schema requires a
 * positive qty, so there was no way to reach that path over HTTP.
 */
export class RemoveCartLine {
  constructor(
    private readonly carts: CartRepository,
    private readonly variants: VariantLookup,
  ) {}

  async execute(cmd: RemoveCartLineCommand): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);

    const variant = await this.variants.byPublicId(cmd.variantId);
    if (!variant) throw new NotFoundError('ProductVariant', cmd.variantId);

    await this.carts.upsertLine(cart.id, variant.id, 0);
    const updated = await this.carts.findByPublicId(cmd.cartPublicId);
    return toDto(updated!);
  }
}
