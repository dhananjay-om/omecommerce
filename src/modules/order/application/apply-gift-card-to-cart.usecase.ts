import type { CartRepository } from '../domain/repositories.js';
import type { GiftCardLedger } from '../../giftcard/domain/repositories.js';
import { hashGiftCardCode } from '../../giftcard/infrastructure/code.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

/**
 * Unauthenticated, bearer-code trust — same level as the gift card
 * balance-check route (GET /store/v1/gift-cards/:code/balance), not the
 * customer's own session (plan/15 Phase 5). Persists only WHICH gift card
 * (CartTender), never an amount — exactly like ApplyCouponToCart persists
 * only the code, never discountAmount. A cart can carry several distinct
 * gift card tenders (stackable), so re-applying the same code is a no-op
 * (CartRepository.addTender is idempotent), not an error.
 */
export class ApplyGiftCardToCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly giftCards: GiftCardLedger,
    private readonly enrichCartView: EnrichCartView,
    private readonly hmacSecret: string,
  ) {}

  async execute(cmd: { cartPublicId: string; code: string }): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);

    const giftCard = await this.giftCards.findByCodeHash(hashGiftCardCode(cmd.code, this.hmacSecret));
    if (!giftCard) throw new NotFoundError('gift card', 'code');
    if (giftCard.status !== 'ACTIVE') {
      throw new ValidationError('gift card is not active', [{ path: 'code', message: `status is ${giftCard.status}` }]);
    }
    if (giftCard.expiresAt && giftCard.expiresAt.getTime() < Date.now()) {
      throw new ValidationError('gift card has expired', [{ path: 'code', message: 'expired' }]);
    }
    if (giftCard.currency !== cart.currency) {
      throw new ValidationError('gift card currency does not match this cart', [{ path: 'code', message: `gift card is ${giftCard.currency}, cart is ${cart.currency}` }]);
    }

    await this.carts.addTender(cart.id, 'GIFT_CARD', giftCard.id);
    const updated = await this.carts.findByPublicId(cmd.cartPublicId);
    return this.enrichCartView.execute(updated!);
  }
}
