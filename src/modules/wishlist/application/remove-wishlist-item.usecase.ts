import type { WishlistRepository, WishlistItemRepository, ProductExistenceLookup, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { RemoveWishlistItemCommand } from './dto.js';

export class RemoveWishlistItem {
  constructor(
    private readonly wishlists: WishlistRepository,
    private readonly items: WishlistItemRepository,
    private readonly products: ProductExistenceLookup,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(cmd: RemoveWishlistItemCommand): Promise<void> {
    const customerId = await this.customers.findIdByPublicId(cmd.customerPublicId);
    if (!customerId) {
      throw new NotFoundError('customer', cmd.customerPublicId);
    }
    const wishlist = await this.wishlists.findByCustomerAndPublicId(customerId, cmd.wishlistPublicId);
    if (!wishlist) {
      throw new NotFoundError('wishlist', cmd.wishlistPublicId);
    }
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product) {
      throw new NotFoundError('product', cmd.productPublicId);
    }
    const removed = await this.items.remove(wishlist.id, product.id);
    if (!removed) {
      throw new NotFoundError('wishlist item', cmd.productPublicId);
    }
  }
}
