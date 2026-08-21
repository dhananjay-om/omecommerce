import type { ProductRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { GetStoreProductDetail } from './get-store-product-detail.usecase.js';
import type { StoreProductDetailView } from './dto.js';

/**
 * The storefront PDP's real entry point (/{slug}.html) — resolves the slug to
 * a product, then delegates entirely to GetStoreProductDetail (unchanged),
 * same "thin slug-to-id resolver in front of the existing usecase" pattern
 * GetCategoryBySlug/GetStoreProductDetail's own :publicId route already
 * establish elsewhere. Kept as a separate usecase rather than teaching
 * GetStoreProductDetail two lookup strategies — that usecase's own cache key
 * (pdpCacheKey) is publicId-keyed, and it stays that way regardless of which
 * URL a shopper actually typed.
 */
export class GetStoreProductDetailBySlug {
  constructor(
    private readonly products: ProductRepository,
    private readonly getStoreProductDetail: GetStoreProductDetail,
  ) {}

  async execute(slug: string, storeViewId: string): Promise<StoreProductDetailView> {
    const product = await this.products.findBySlug(slug);
    if (!product || !product.props.publicId) throw new NotFoundError('Product', slug);
    return this.getStoreProductDetail.execute({ productPublicId: product.props.publicId, storeViewId });
  }
}
