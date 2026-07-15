import type { WishlistRepository, WishlistItemRepository, ProductExistenceLookup, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { AddWishlistItemCommand } from './dto.js';

export class AddWishlistItem {
  constructor(
    private readonly wishlists: WishlistRepository,
    private readonly items: WishlistItemRepository,
    private readonly products: ProductExistenceLookup,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(cmd: AddWishlistItemCommand): Promise<void> {
    const customerId = await this.customers.findIdByPublicId(cmd.customerPublicId);
    if (!customerId) {
      throw new NotFoundError('customer', cmd.customerPublicId);
    }
    // Scoped to (customerId, wishlistPublicId) so a customer can never add to
    // another customer's wishlist — a 404 here means either "no such wishlist"
    // or "not this customer's", deliberately indistinguishable to the caller.
    const wishlist = await this.wishlists.findByCustomerAndPublicId(customerId, cmd.wishlistPublicId);
    if (!wishlist) {
      throw new NotFoundError('wishlist', cmd.wishlistPublicId);
    }
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product) {
      throw new NotFoundError('product', cmd.productPublicId);
    }
    await this.items.add(wishlist.id, product.id);
  }
}
