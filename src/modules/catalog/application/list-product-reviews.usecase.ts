import type { ProductRepository, ProductReviewRepository, ProductReviewInfo, MediaStorage } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { ProductReviewView } from './dto.js';

async function toView(r: ProductReviewInfo, storage: MediaStorage): Promise<ProductReviewView> {
  return {
    publicId: r.publicId,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    images: await Promise.all(r.imageKeys.map((k) => storage.presignGetUrl(k))),
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
    private readonly storage: MediaStorage,
  ) {}

  async execute(productPublicId: string): Promise<ProductReviewView[]> {
    const product = await this.products.findByPublicId(productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', productPublicId);

    const rows = await this.reviews.listForProduct(product.props.id);
    return Promise.all(rows.map((r) => toView(r, this.storage)));
  }
}
