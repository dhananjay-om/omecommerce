import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ProductReviewRepository, ProductReviewInfo } from '../domain/repositories.js';

/** Read-only adapter — see ProductReview's own schema doc comment (there's
 *  no write path; this table has no submission/moderation flow to write
 *  through). */
export class PrismaProductReviewRepository implements ProductReviewRepository {
  constructor(private readonly db: Db) {}

  async listForProduct(productId: bigint): Promise<ProductReviewInfo[]> {
    const rows = await this.db.productReview.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      publicId: r.publicId,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt,
    }));
  }
}
