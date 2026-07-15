import type { WishlistRepository, WishlistItemRepository, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { WishlistView } from './dto.js';

/** GET /me/wishlists — each wishlist WITH its items nested (plan/05 §2.6: no separate items-read endpoint). */
export class ListWishlists {
  constructor(
    private readonly wishlists: WishlistRepository,
    private readonly items: WishlistItemRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(customerPublicId: string): Promise<WishlistView[]> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) {
      throw new NotFoundError('customer', customerPublicId);
    }
    const wishlists = await this.wishlists.listByCustomerId(customerId);
    return Promise.all(
      wishlists.map(async (w) => {
        const rows = await this.items.listByWishlistId(w.id);
        return {
          publicId: w.publicId,
          name: w.name,
          items: rows.map((r) => ({ productId: r.productPublicId, sku: r.sku, name: r.name, addedAt: r.addedAt.toISOString() })),
        };
      }),
    );
  }
}
