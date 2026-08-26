import type { ProductRepository, ProductReviewRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { ProductReviewListView } from './dto.js';

const DEFAULT_PAGE_SIZE = 10;

/** The public storefront read — approved-only, paginated, plus a rating
 *  breakdown/average for the PDP's star summary. This is the one place in
 *  this feature that genuinely needs pagination (unlike the admin
 *  moderation queue, which is small enough to list in full). */
export class ListApprovedProductReviews {
  constructor(
    private readonly products: ProductRepository,
    private readonly reviews: ProductReviewRepository,
  ) {}

  async execute(productPublicId: string, page?: number, pageSize?: number): Promise<ProductReviewListView> {
    const product = await this.products.findByPublicId(productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', productPublicId);

    const [{ total, page: resolvedPage, pageSize: resolvedPageSize, reviews }, breakdown] = await Promise.all([
      this.reviews.listApprovedForProduct(product.props.id, page ?? 1, pageSize ?? DEFAULT_PAGE_SIZE),
      this.reviews.countByRating(product.props.id, true),
    ]);

    const approvedTotal = breakdown[1] + breakdown[2] + breakdown[3] + breakdown[4] + breakdown[5];
    const weightedSum = breakdown[1] * 1 + breakdown[2] * 2 + breakdown[3] * 3 + breakdown[4] * 4 + breakdown[5] * 5;
    const averageRating = approvedTotal > 0 ? weightedSum / approvedTotal : null;

    return {
      total,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      averageRating,
      ratingBreakdown: breakdown,
      reviews: reviews.map((r) => ({
        publicId: r.publicId,
        customerName: r.customerName,
        rating: r.rating,
        title: r.title,
        body: r.body,
        isApproved: r.isApproved,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
