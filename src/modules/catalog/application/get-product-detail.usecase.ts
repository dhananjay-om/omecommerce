import type {
  ProductRepository,
  ProductVariantRepository,
  ProductAttributeStore,
  ProductCategoryRepository,
} from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { fromRow } from '../domain/attribute-value.js';
import { toView } from './create-product.usecase.js';
import type { ProductDetailView } from './dto.js';

/**
 * Admin detail (plan/12 Admin UI) — raw fields + variants + GLOBAL-scope
 * attribute values. Read-only for this pass (no admin GET-by-id endpoint
 * existed at all before this — the only prior product GET was the
 * storefront PDP route, which needs a storeViewId and returns store-view-
 * resolved fields, not admin-appropriate ones). A full attribute-value
 * editing UI covering WEBSITE/STORE/STORE_VIEW overrides is real, separate
 * future work — see ProductAttributeStore.resolveGlobalValues's doc comment.
 */
export class GetProductDetail {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
    private readonly attrStore: ProductAttributeStore,
    private readonly productCategories: ProductCategoryRepository,
  ) {}

  async execute(productPublicId: string): Promise<ProductDetailView> {
    const product = await this.products.findByPublicId(productPublicId);
    if (!product || product.props.id === null) {
      throw new NotFoundError('product', productPublicId);
    }

    const [variantRows, attributeRows, categoryIds] = await Promise.all([
      this.variants.listByProductId(product.props.id),
      this.attrStore.resolveGlobalValues(product.props.id),
      this.productCategories.listCategoryPublicIdsForProduct(product.props.id),
    ]);

    const attributes: Record<string, unknown> = {};
    for (const r of attributeRows) attributes[r.code] = fromRow(r.dataType, r.columns);

    return {
      ...toView(product),
      attributeSetId: product.props.attributeSetId.toString(),
      variants: variantRows,
      attributes,
      categoryIds,
    };
  }
}
