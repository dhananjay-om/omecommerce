import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WishlistItemRepository, WishlistItemInfo } from '../domain/repositories.js';

export class PrismaWishlistItemRepository implements WishlistItemRepository {
  constructor(private readonly db: Db) {}

  async add(wishlistId: bigint, productId: bigint): Promise<void> {
    // createMany + skipDuplicates: adding a product already on the list is a
    // harmless no-op (idempotent "add to wishlist" UX), not a 409.
    await this.db.wishlistItem.createMany({ data: [{ wishlistId, productId }], skipDuplicates: true });
  }

  async remove(wishlistId: bigint, productId: bigint): Promise<boolean> {
    const result = await this.db.wishlistItem.deleteMany({ where: { wishlistId, productId } });
    return result.count > 0;
  }

  async listByWishlistId(wishlistId: bigint): Promise<WishlistItemInfo[]> {
    const rows = await this.db.wishlistItem.findMany({
      where: { wishlistId },
      select: { addedAt: true, product: { select: { publicId: true, sku: true, slug: true, nameDefault: true } } },
      orderBy: { addedAt: 'desc' },
    });
    return rows.map((r) => ({
      productPublicId: r.product.publicId,
      sku: r.product.sku,
      slug: r.product.slug,
      name: r.product.nameDefault,
      addedAt: r.addedAt,
    }));
  }
}
