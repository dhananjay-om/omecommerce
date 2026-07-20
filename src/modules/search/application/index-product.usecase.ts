import type { ProductAttributeStore } from '../../catalog/domain/repositories.js';
import { fromRow } from '../../catalog/domain/attribute-value.js';
import type { PriceResolver } from '../../pricing/domain/repositories.js';
import type {
  ProductLookup,
  StoreViewLookup,
  AttributeFlagsLookup,
  StockAvailabilityLookup,
  CategoryMembershipLookup,
  BrandLookup,
  ProductMediaLookup,
} from '../domain/repositories.js';
import type { SearchIndex, ProductDocument, FacetPair } from '../domain/ports.js';
import { CATEGORY_FACET_CODE, BRAND_FACET_CODE } from '../domain/ports.js';

/**
 * Projects one product into a ProductDocument per active store view (plan/06).
 * Reuses Catalog's ProductAttributeStore.resolveForStoreView (the single-pass
 * scope-resolution query) and Pricing's PriceResolver directly — both encode a
 * correctness-critical resolution algorithm that must have exactly one
 * implementation, same rule applied to Order's reuse of StockLedger/PriceResolver.
 */
export class IndexProduct {
  constructor(
    private readonly products: ProductLookup,
    private readonly storeViews: StoreViewLookup,
    private readonly attributeStore: ProductAttributeStore,
    private readonly facetableAttributes: AttributeFlagsLookup,
    private readonly priceResolver: PriceResolver,
    private readonly stockAvailability: StockAvailabilityLookup,
    private readonly categoryMembership: CategoryMembershipLookup,
    private readonly brandLookup: BrandLookup,
    private readonly productMedia: ProductMediaLookup,
    private readonly index: SearchIndex,
  ) {}

  async execute(productPublicId: string): Promise<void> {
    const product = await this.products.byPublicId(productPublicId);
    if (!product) {
      await this.index.deleteByProductId(productPublicId);
      return;
    }

    const variantId = await this.products.firstVariantId(product.id);
    const [storeViews, facetable, isInStock, categoryIds, brandPublicId, imageKey] = await Promise.all([
      this.storeViews.allActive(),
      this.facetableAttributes.facetable(),
      this.stockAvailability.isInStock(product.id),
      this.categoryMembership.categoryPublicIds(product.id),
      this.brandLookup.brandPublicId(product.id),
      this.productMedia.primaryImageKey(product.id),
    ]);
    const facetableCodes = new Set(facetable.map((a) => a.code));

    for (const sv of storeViews) {
      const resolved = await this.attributeStore.resolveForStoreView(product.id, {
        websiteId: sv.websiteId,
        storeId: sv.storeId,
        storeViewId: sv.id,
      });

      const facets: FacetPair[] = [];
      for (const r of resolved) {
        if (!facetableCodes.has(r.code)) continue;
        const value = fromRow(r.dataType, r.columns);
        if (Array.isArray(value)) {
          for (const v of value) facets.push({ code: r.code, value: String(v) });
        } else if (value !== null && value !== undefined) {
          facets.push({ code: r.code, value: String(value) });
        }
      }
      for (const categoryId of categoryIds) facets.push({ code: CATEGORY_FACET_CODE, value: categoryId });
      if (brandPublicId) facets.push({ code: BRAND_FACET_CODE, value: brandPublicId });

      let price: number | null = null;
      let priceDisplay: string | null = null;
      if (variantId) {
        const resolvedPrice = await this.priceResolver.resolve({
          variantId,
          qty: 1,
          currency: sv.currency,
          customerGroupId: null,
          websiteId: sv.websiteId,
          asOf: new Date(),
        });
        if (resolvedPrice) {
          price = Number(resolvedPrice.price);
          priceDisplay = resolvedPrice.price;
        }
      }

      const doc: ProductDocument = {
        productId: product.publicId,
        storeViewId: sv.id.toString(),
        sku: product.sku,
        name: product.name ?? product.sku,
        type: product.type,
        status: product.status,
        visibility: product.visibility,
        isInStock,
        price,
        priceDisplay,
        currency: priceDisplay ? sv.currency : null,
        imageKey,
        facets,
        updatedAt: new Date().toISOString(),
      };
      await this.index.upsert(doc);
    }
  }
}
