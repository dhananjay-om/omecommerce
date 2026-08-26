import type { ProductRepository, ProductReviewRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { ProductReviewView } from './dto.js';

/** Read-only, mirrors get-product-detail.usecase.ts's own resolve-then-read
 *  shape. No pagination — reviews are a small, admin-only read (this system
 *  has no submission flow to grow the count unbounded); add it if that ever
 *  changes. */
export class ListProductReviews {
  constructor(
    private readonly products: ProductRepository,
    private readonly reviews: ProductReviewRepository,
  ) {}

  async execute(productPublicId: string): Promise<ProductReviewView[]> {
    const product = await this.products.findByPublicId(productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', productPublicId);

    const rows = await this.reviews.listForProduct(product.props.id);
    return rows.map((r) => ({
      publicId: r.publicId,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
