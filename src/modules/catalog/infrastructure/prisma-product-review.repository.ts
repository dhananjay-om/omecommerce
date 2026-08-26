import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type {
  ProductReviewRepository,
  ProductReviewInfo,
  CreateProductReviewInput,
  RatingBreakdown,
  PaginatedProductReviews,
  ListAllReviewsFilter,
  PaginatedAdminReviews,
} from '../domain/repositories.js';

interface ReviewRow {
  publicId: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  imageKeys: string[];
  isApproved: boolean;
  createdAt: Date;
}

function toInfo(r: ReviewRow): ProductReviewInfo {
  return {
    publicId: r.publicId,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    imageKeys: r.imageKeys,
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

  async listAll(filter: ListAllReviewsFilter): Promise<PaginatedAdminReviews> {
    const where = filter.isApproved === undefined ? {} : { isApproved: filter.isApproved };
    const [total, rows] = await this.db.$transaction([
      this.db.productReview.count({ where }),
      this.db.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        // nameDefault, not the EAV-resolved per-storeView `name` GetProductDetail
        // computes — a plain denormalized column (see catalog.prisma's own
        // comment on it), good enough for an admin queue label and avoids
        // pulling the whole attribute-resolution path in for a list read.
        include: { product: { select: { publicId: true, nameDefault: true, sku: true } } },
      }),
    ]);
    return {
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      reviews: rows.map((r) => ({ ...toInfo(r), productPublicId: r.product.publicId, productName: r.product.nameDefault ?? r.product.sku })),
    };
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
        imageKeys: input.imageKeys,
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
