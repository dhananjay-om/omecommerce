import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WishlistRepository, WishlistInfo } from '../domain/repositories.js';

const WISHLIST_SELECT = { id: true, publicId: true, name: true } as const;

export class PrismaWishlistRepository implements WishlistRepository {
  constructor(private readonly db: Db) {}

  async create(customerId: bigint, name: string): Promise<WishlistInfo> {
    return this.db.wishlist.create({ data: { customerId, name }, select: WISHLIST_SELECT });
  }

  async listByCustomerId(customerId: bigint): Promise<WishlistInfo[]> {
    return this.db.wishlist.findMany({ where: { customerId }, select: WISHLIST_SELECT, orderBy: { id: 'asc' } });
  }

  async findByCustomerAndPublicId(customerId: bigint, wishlistPublicId: string): Promise<WishlistInfo | null> {
    return this.db.wishlist.findFirst({ where: { customerId, publicId: wishlistPublicId }, select: WISHLIST_SELECT });
  }
}
