import type { ProductRepository, ProductReviewRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { ProductReviewView } from './dto.js';

function toView(r: { publicId: string; customerName: string; rating: number; title: string | null; body: string; isApproved: boolean; createdAt: Date }): ProductReviewView {
  return {
    publicId: r.publicId,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    isApproved: r.isApproved,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Admin moderation queue — unpaginated (small volume), every status
 *  (pending/approved/rejected), mirrors get-product-detail.usecase.ts's
 *  own resolve-then-read shape. */
export class ListProductReviews {
  constructor(
    private readonly products: ProductRepository,
    private readonly reviews: ProductReviewRepository,
  ) {}

  async execute(productPublicId: string): Promise<ProductReviewView[]> {
    const product = await this.products.findByPublicId(productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', productPublicId);

    const rows = await this.reviews.listForProduct(product.props.id);
    return rows.map(toView);
  }
}
