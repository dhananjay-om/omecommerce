import type { ProductRepository, ProductAttributeStore } from '../domain/repositories.js';
import type { StoreContextResolver } from '../../../shared/application/scope.js';
import { fromRow } from '../domain/attribute-value.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { ProductForStoreView, ProductForStoreViewQuery } from './dto.js';

/**
 * Storefront read: product core + attributes resolved for a specific store view.
 * This is a QUERY (CQRS read side, plan/03 §2) — it may bypass the domain and read
 * the scope-resolved projection directly.
 */
export class GetProductForStoreView {
  constructor(
    private readonly products: ProductRepository,
    private readonly store: ProductAttributeStore,
    private readonly storeContext: StoreContextResolver,
  ) {}

  async execute(query: ProductForStoreViewQuery): Promise<ProductForStoreView> {
    if (!/^\d+$/.test(query.storeViewId)) {
      throw new ValidationError('invalid storeViewId', [{ path: 'storeViewId', message: 'numeric' }]);
    }
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
      type: p.type,
      status: p.status,
      visibility: p.visibility,
      name: p.nameDefault,
      storeViewId: query.storeViewId,
      currency: ctx.currency,
      attributes,
    };
  }
}
