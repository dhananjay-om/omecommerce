import type { CartRepository } from '../domain/repositories.js';
import type { DiscountCalculator } from '../../coupon/domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { toMinorUnits } from '../../../shared/domain/decimal.js';
import type { CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

export class ApplyCouponToCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly discountCalculator: DiscountCalculator,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cmd: { cartPublicId: string; code: string }): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);
    if (cart.lines.length === 0) {
      throw new ValidationError('cart is empty', [{ path: 'cart', message: 'must have at least one line' }]);
    }

    // Validate before persisting — a real cart preview needs the subtotal, so
    // enrich first (this also gives the caller a same-shaped error path as
    // checkout's own re-validation, via DiscountCalculator throwing a typed
    // CouponError the interface layer already knows how to map).
    const enriched = await this.enrichCartView.execute(cart);
    const subtotalMinor = enriched.subtotal !== null ? toMinorUnits(enriched.subtotal) : 0n;
    const evaluation = await this.discountCalculator.evaluate({
      code: cmd.code,
      cartCurrency: cart.currency,
      subtotalMinor,
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
