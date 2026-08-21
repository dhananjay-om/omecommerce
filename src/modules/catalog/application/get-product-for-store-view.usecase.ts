import type { ProductRepository, ProductAttributeStore } from '../domain/repositories.js';
import type { StoreContextResolver } from '../../../shared/application/scope.js';
import type { CacheAside } from '../../../shared/infrastructure/cache/cache-aside.js';
import { fromRow } from '../domain/attribute-value.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { ProductForStoreView, ProductForStoreViewQuery } from './dto.js';

const PDP_CACHE_TTL_SECONDS = 300;

export function pdpCacheKey(productPublicId: string, storeViewId: string): string {
  return `pdp:${productPublicId}:${storeViewId}`;
}

/** Every PDP cache entry for a product, across all store views — used on invalidation. */
export function pdpCachePrefix(productPublicId: string): string {
  return `pdp:${productPublicId}:`;
}

/**
 * Storefront read: product core + attributes resolved for a specific store view.
 * This is a QUERY (CQRS read side, plan/03 §2) — it may bypass the domain and read
 * the scope-resolved projection directly. Cache-aside (plan/09 §3): a hit skips
 * both the store-context lookup and the scope-resolution query entirely.
 * Invalidated directly by AssignAttributeValue (plan/09 §3's "event-driven
 * invalidation" — here a direct call rather than routed through the outbox,
 * since Catalog doesn't emit outbox events yet; TTL is the fallback either way).
 */
export class GetProductForStoreView {
  constructor(
    private readonly products: ProductRepository,
    private readonly store: ProductAttributeStore,
    private readonly storeContext: StoreContextResolver,
    private readonly cache: CacheAside,
  ) {}

  async execute(query: ProductForStoreViewQuery): Promise<ProductForStoreView> {
    if (!/^\d+$/.test(query.storeViewId)) {
      throw new ValidationError('invalid storeViewId', [{ path: 'storeViewId', message: 'numeric' }]);
    }
    return this.cache.getOrSet(pdpCacheKey(query.productPublicId, query.storeViewId), PDP_CACHE_TTL_SECONDS, () =>
      this.resolve(query),
    );
  }

  private async resolve(query: ProductForStoreViewQuery): Promise<ProductForStoreView> {
    const ctx = await this.storeContext.byStoreViewId(BigInt(query.storeViewId));
    if (!ctx) throw new NotFoundError('StoreView', query.storeViewId);

    const product = await this.products.findByPublicId(query.productPublicId);
    if (!product) throw new NotFoundError('Product', query.productPublicId);

    const resolved = await this.store.resolveForStoreView(product.props.id!, {
      websiteId: ctx.websiteId,
      storeId: ctx.storeId,
      storeViewId: ctx.storeViewId,
    });

    const attributes: Record<string, unknown> = {};
    for (const r of resolved) attributes[r.code] = fromRow(r.dataType, r.columns);

    const p = product.props;
    return {
      publicId: p.publicId!,
      sku: p.sku,
      slug: p.slug,
      type: p.type,
      status: p.status,
      visibility: p.visibility,
      name: p.nameDefault,
      weight: p.weight,
      // Admin-only fields (inherited from ProductView for reuse, never actually
      // shown to a customer) — GST tax class/HSN aren't storefront-relevant.
      taxClassId: null,
      hsnCode: null,
      storeViewId: query.storeViewId,
      currency: ctx.currency,
      pricesIncludeTax: ctx.pricesIncludeTax,
      attributes,
    };
  }
}
