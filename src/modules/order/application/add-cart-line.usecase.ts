import type { CartRepository, VariantLookup } from '../domain/repositories.js';
import type { CartStockLookup } from '../domain/ports.js';
import { DomainError, NotFoundError } from '../../../shared/domain/errors.js';
import type { AddCartLineCommand, CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

/** Raised when the requested quantity is more than is in stock. The message is
 *  shown to the shopper as-is, so it says exactly how many they can have. */
export class CartQuantityExceedsStockError extends DomainError {
  constructor(public readonly available: number) {
    super(
      available <= 0 ? 'Sorry, this item is out of stock.' : `Only ${available} in stock — you can't add more than ${available}.`,
      'https://errors.ome/insufficient-stock',
      409,
    );
  }
}

export class AddCartLine {
  constructor(
    private readonly carts: CartRepository,
    private readonly variants: VariantLookup,
    private readonly enrichCartView: EnrichCartView,
    private readonly stock: CartStockLookup,
  ) {}

  /** `qty` is the line's new TOTAL quantity (the repository upserts, it doesn't
   *  add), so that's what is checked against stock. */
  async execute(cmd: AddCartLineCommand): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);

    const variant = await this.variants.byPublicId(cmd.variantId);
    if (!variant) throw new NotFoundError('ProductVariant', cmd.variantId);

    const available = (await this.stock.availableByVariant([variant.id], cart.storeViewId)).get(variant.id.toString());
    if (available !== undefined && cmd.qty > available) throw new CartQuantityExceedsStockError(available);

    await this.carts.upsertLine(cart.id, variant.id, cmd.qty);
    const updated = await this.carts.findByPublicId(cmd.cartPublicId);
    return this.enrichCartView.execute(updated!);
  }
}
