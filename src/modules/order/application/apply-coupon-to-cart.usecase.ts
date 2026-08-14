import type { CartRepository, VariantLookup } from '../domain/repositories.js';
import type { DiscountCalculator, DiscountLineInput } from '../../coupon/domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { toMinorUnits } from '../../../shared/domain/decimal.js';
import type { CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

export class ApplyCouponToCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly variants: VariantLookup,
    private readonly discountCalculator: DiscountCalculator,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cmd: { cartPublicId: string; code: string }): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);
    if (cart.lines.length === 0) {
      throw new ValidationError('cart is empty', [{ path: 'cart', message: 'must have at least one line' }]);
    }

    // Validate before persisting — a real cart preview needs each line's live
    // price (and, for an ITEM-target coupon, its product), so enrich first
    // (this also gives the caller a same-shaped error path as checkout's own
    // re-validation, via DiscountCalculator throwing a typed CouponError the
    // interface layer already knows how to map).
    const enriched = await this.enrichCartView.execute(cart);
    const discountLines: DiscountLineInput[] = [];
    for (let i = 0; i < cart.lines.length; i++) {
      const lineTotal = enriched.lines[i]?.lineTotal;
      if (lineTotal === null || lineTotal === undefined) continue; // unpriced — excluded from coupon math, same as EnrichCartView's subtotal
      const variant = await this.variants.byId(cart.lines[i]!.variantId);
      if (!variant) continue;
      discountLines.push({ variantId: cart.lines[i]!.variantId, productId: variant.productId, subtotalMinor: toMinorUnits(lineTotal) });
    }
    const evaluation = await this.discountCalculator.evaluate({
      code: cmd.code,
      cartCurrency: cart.currency,
      lines: discountLines,
      customerId: cart.customerId,
      asOf: new Date(),
    });

    // Persist the canonical stored code (evaluation.code), not the user's raw
    // input casing — Coupon.code is Citext (case-insensitive matching), but
    // Cart.couponCode should read back exactly as the coupon was created.
    await this.carts.setCouponCode(cart.id, evaluation.code);
    const updated = await this.carts.findByPublicId(cmd.cartPublicId);
    return this.enrichCartView.execute(updated!);
  }
}
