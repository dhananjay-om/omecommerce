import type {
  ProductRepository,
  ProductVariantRepository,
  ProductCategoryRepository,
  ProductMediaRepository,
  MediaStorage,
  VariantStockLookup,
} from '../domain/repositories.js';
import type { PriceResolver } from '../../pricing/domain/repositories.js';
import type { StoreContextResolver } from '../../../shared/application/scope.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { GetProductForStoreView } from './get-product-for-store-view.usecase.js';
import type { ProductForStoreViewQuery, StoreProductDetailView, StoreProductVariantView, ProductMediaView } from './dto.js';

/**
 * The full storefront PDP (plan/14 Phase 0c): composes the cached, attributes-
 * only GetProductForStoreView with price/stock/media/variants/categories/brand,
 * fetched fresh on every call rather than sharing that 300s cache TTL — those
 * fields change on a different cadence (a stock-out shouldn't wait 5 minutes to
 * show).
 */
export class GetStoreProductDetail {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
    private readonly productCategories: ProductCategoryRepository,
    private readonly productMedia: ProductMediaRepository,
    private readonly storage: MediaStorage,
    private readonly priceResolver: PriceResolver,
    private readonly variantStock: VariantStockLookup,
    private readonly storeContext: StoreContextResolver,
    private readonly getProductForStoreView: GetProductForStoreView,
  ) {}

  async execute(query: ProductForStoreViewQuery): Promise<StoreProductDetailView> {
    if (!/^\d+$/.test(query.storeViewId)) {
      throw new ValidationError('invalid storeViewId', [{ path: 'storeViewId', message: 'numeric' }]);
    }

    const [base, product, ctx] = await Promise.all([
      this.getProductForStoreView.execute(query),
      this.products.findByPublicId(query.productPublicId),
      this.storeContext.byStoreViewId(BigInt(query.storeViewId)),
    ]);
    if (!product || product.props.id === null) throw new NotFoundError('Product', query.productPublicId);
    if (!ctx) throw new NotFoundError('StoreView', query.storeViewId);
    const productId = product.props.id;

    const [variantRows, mediaRows, categoryIds, brandSlug] = await Promise.all([
      this.variants.listByProductId(productId),
      this.productMedia.listForProduct(productId),
      this.productCategories.listCategoryPublicIdsForProduct(productId),
      this.products.findBrandSlug(productId),
    ]);

    const variants: StoreProductVariantView[] = await Promise.all(
      variantRows.map(async (v) => {
        const [resolvedPrice, inStock] = await Promise.all([
          this.priceResolver.resolve({
            variantId: v.id,
            qty: 1,
            currency: ctx.currency,
            customerGroupId: null,
            websiteId: ctx.websiteId,
            asOf: new Date(),
          }),
          this.variantStock.isInStock(v.id),
        ]);
        return {
          publicId: v.publicId,
          sku: v.sku,
          status: v.status,
          position: v.position,
          price: resolvedPrice?.price ?? null,
          mrp: resolvedPrice?.mrp ?? null,
          inStock,
          axisValues: v.axisValues.map((a) => ({
            attributeCode: a.attributeCode,
            attributeLabel: a.attributeLabel,
            optionLabel: a.optionLabel,
          })),
        };
      }),
    );

    const media: ProductMediaView[] = await Promise.all(
      mediaRows.map(async (m) => ({
        productMediaId: m.id.toString(),
        url: await this.storage.presignGetUrl(m.assetStorageKey),
        role: m.role,
        position: m.position,
        altText: m.altOverride ?? m.assetAltDefault,
      })),
    );

    // Representative variant for the top-level price/stock summary: first by
    // position (the same merchandising order variants already display in admin),
    // not first by id like search's indexing heuristic — position is the
    // merchant's own intentional "default variant" signal when set.
    const first = variants[0];

    return {
      ...base,
      price: first?.price ?? null,
      mrp: first?.mrp ?? null,
      inStock: first?.inStock ?? false,
      media,
      variants,
      categoryIds,
      brandSlug,
    };
  }
}
