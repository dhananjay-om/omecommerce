import type { CartRepository } from '../domain/repositories.js';
import type { GiftCardLedger } from '../../giftcard/domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CartView } from './dto.js';
import type { EnrichCartView } from './enrich-cart-view.js';

/**
 * Unlike ApplyGiftCardToCart (bearer-code trust — proves possession of the
 * card), removal needs no such proof: "forget this tender from my cart"
 * doesn't require re-typing the code, and the storefront never retains the
 * full code past the moment it was used to apply it (only last4 is shown
 * back — see CartTenderDto.giftCardPublicId's doc comment). So removal
 * targets the card's own publicId instead, which the cart response already
 * exposed when the card was applied. No-op if that card isn't applied.
 */
export class RemoveGiftCardFromCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly giftCards: GiftCardLedger,
    private readonly enrichCartView: EnrichCartView,
  ) {}

  async execute(cmd: { cartPublicId: string; giftCardPublicId: string }): Promise<CartView> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);

    const giftCard = await this.giftCards.findByPublicId(cmd.giftCardPublicId);
    if (!giftCard) throw new NotFoundError('gift card', cmd.giftCardPublicId);

    await this.carts.removeTender(cart.id, 'GIFT_CARD', giftCard.id);
    const updated = await this.carts.findByPublicId(cmd.cartPublicId);
    return this.enrichCartView.execute(updated!);
  }
}
