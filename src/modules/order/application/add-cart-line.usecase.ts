import type { CartRepository, VariantLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toDto } from './create-cart.usecase.js';
import type { AddCartLineCommand, CartView } from './dto.js';

export class AddCartLine {
  constructor(
    private readonly carts: CartRepository,
    private readonly variants: VariantLookup,
  ) {}

  async execute(cmd: AddCartLineCommand): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);

    const variant = await this.variants.byPublicId(cmd.variantId);
    if (!variant) throw new NotFoundError('ProductVariant', cmd.variantId);

    await this.carts.upsertLine(cart.id, variant.id, cmd.qty);
    const updated = await this.carts.findByPublicId(cmd.cartPublicId);
    return toDto(updated!);
  }
}
