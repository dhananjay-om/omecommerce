import type { WishlistRepository, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CreateWishlistCommand, WishlistView } from './dto.js';

export class CreateWishlist {
  constructor(
    private readonly wishlists: WishlistRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(cmd: CreateWishlistCommand): Promise<WishlistView> {
    const customerId = await this.customers.findIdByPublicId(cmd.customerPublicId);
    if (!customerId) {
      throw new NotFoundError('customer', cmd.customerPublicId);
    }
    const wishlist = await this.wishlists.create(customerId, cmd.name?.trim() || 'default');
    return { publicId: wishlist.publicId, name: wishlist.name, items: [] };
  }
}
