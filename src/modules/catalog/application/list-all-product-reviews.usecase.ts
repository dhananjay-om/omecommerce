import type { ProductReviewRepository, MediaStorage } from '../domain/repositories.js';
import type { PaginatedAdminReviewsView } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;

/** Backs the admin's cross-product Reviews queue (Commerce > Reviews) —
 *  every product's reviews in one paginated, filterable-by-status list,
 *  unlike ListProductReviews which needs a product already in hand (the
 *  per-product Reviews tab still uses that one; this is for moderating
 *  without first hunting down which product a review belongs to). */
export class ListAllProductReviews {
  constructor(
    private readonly reviews: ProductReviewRepository,
    private readonly storage: MediaStorage,
  ) {}

  async execute(isApproved?: boolean, page?: number, pageSize?: number): Promise<PaginatedAdminReviewsView> {
    const result = await this.reviews.listAll({ isApproved, page: page ?? 1, pageSize: pageSize ?? DEFAULT_PAGE_SIZE });

    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      reviews: await Promise.all(
        result.reviews.map(async (r) => ({
          publicId: r.publicId,
          productPublicId: r.productPublicId,
          productName: r.productName,
          customerName: r.customerName,
          rating: r.rating,
          title: r.title,
          body: r.body,
          images: await Promise.all(r.imageKeys.map((k) => this.storage.presignGetUrl(k))),
          isApproved: r.isApproved,
          createdAt: r.createdAt.toISOString(),
        })),
      ),
    };
  }
}
