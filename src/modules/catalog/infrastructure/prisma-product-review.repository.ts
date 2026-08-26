import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type {
  ProductReviewRepository,
  ProductReviewInfo,
  CreateProductReviewInput,
  RatingBreakdown,
  PaginatedProductReviews,
} from '../domain/repositories.js';

function toInfo(r: { publicId: string; customerName: string; rating: number; title: string | null; body: string; isApproved: boolean; createdAt: Date }): ProductReviewInfo {
  return {
    publicId: r.publicId,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    isApproved: r.isApproved,
    createdAt: r.createdAt,
  };
}

/** Real submission + moderation adapter — see ProductReview's own schema
 *  doc comment for the "upgraded from admin-only-read" history. */
export class PrismaProductReviewRepository implements ProductReviewRepository {
  constructor(private readonly db: Db) {}

  async listForProduct(productId: bigint): Promise<ProductReviewInfo[]> {
    const rows = await this.db.productReview.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toInfo);
  }

  async listApprovedForProduct(productId: bigint, page: number, pageSize: number): Promise<PaginatedProductReviews> {
    const where = { productId, isApproved: true };
    const [total, rows] = await this.db.$transaction([
      this.db.productReview.count({ where }),
      this.db.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, reviews: rows.map(toInfo) };
  }

  async create(input: CreateProductReviewInput): Promise<ProductReviewInfo> {
    const row = await this.db.productReview.create({
      data: {
        productId: input.productId,
        customerId: input.customerId,
        customerName: input.customerName,
        rating: input.rating,
        title: input.title,
        body: input.body,
        // isApproved uses the schema default (false) — every real
        // submission starts pending moderation.
      },
    });
    return toInfo(row);
  }

  async setApproval(productId: bigint, reviewPublicId: string, isApproved: boolean): Promise<void> {
    const result = await this.db.productReview.updateMany({
      where: { publicId: reviewPublicId, productId },
      data: { isApproved },
    });
    if (result.count === 0) throw new NotFoundError('product review', reviewPublicId);
  }

  async countByRating(productId: bigint, approvedOnly: boolean): Promise<RatingBreakdown> {
    const rows = await this.db.productReview.groupBy({
      by: ['rating'],
      where: { productId, ...(approvedOnly ? { isApproved: true } : {}) },
      _count: { rating: true },
    });
    const breakdown: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of rows) {
      const stars = row.rating as 1 | 2 | 3 | 4 | 5;
      if (stars >= 1 && stars <= 5) breakdown[stars] = row._count.rating;
    }
    return breakdown;
  }
}
