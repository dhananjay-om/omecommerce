import { ScopeType } from '@prisma/client';
import type { ProductRepository, AttributeRepository, ProductAttributeStore, WriteScopedValueInput } from '../domain/repositories.js';
import { toColumns } from '../domain/attribute-value.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CacheAside } from '../../../shared/infrastructure/cache/cache-aside.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import { pdpCachePrefix } from './get-product-for-store-view.usecase.js';
import { resolveScopeTargets } from './assign-attribute-value.usecase.js';
import { URL_KEY_ATTRIBUTE_CODE, syncProductSlugFromUrlKey } from './url-key.js';
import type { AssignAttributeValuesCommand } from './dto.js';

/**
 * Bulk sibling of AssignAttributeValue (singular) — plan/13 Phase H. A product
 * edit form typically saves a dozen+ attributes at once; doing that as N
 * sequential single-attribute PUTs would mean N outbox events for one logical
 * change and ambiguous partial-failure semantics (attribute 3 of 12 invalid,
 * 1-2 already committed). This commits every value in one DB transaction and
 * fires exactly one outbox event. The singular endpoint is unchanged and still
 * used by other callers (e.g. the bulk-import worker, where N independent
 * per-row events is the correct semantics, not a single form save).
 */
export class AssignAttributeValues {
  constructor(
    private readonly products: ProductRepository,
    private readonly attributes: AttributeRepository,
    private readonly store: ProductAttributeStore,
    private readonly cache: CacheAside,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: AssignAttributeValuesCommand): Promise<void> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product) throw new NotFoundError('Product', cmd.productPublicId);

    const inputs: WriteScopedValueInput[] = [];
    const changedCodes: string[] = [];

    for (const item of cmd.values) {
      const attribute = await this.attributes.findByCode(item.attributeCode);
      if (!attribute) throw new NotFoundError('Attribute', item.attributeCode);

      const scope = item.scope ?? ScopeType.GLOBAL;
      const targets = resolveScopeTargets({ ...item, scope });

      // The one attribute code that isn't "just save whatever was typed" —
      // see url-key.ts's own doc comment on why this single field also
      // drives Product.slug (the storefront's actual routing key). Both
      // stores end up with the SAME normalized value: what's written into
      // product_attribute_value below is syncProductSlugFromUrlKey's
      // slugified return value, not the raw typed input.
      const value =
        item.attributeCode === URL_KEY_ATTRIBUTE_CODE && scope === ScopeType.GLOBAL
          ? await syncProductSlugFromUrlKey(this.products, product.props.id!, String(item.value))
          : item.value;
      const columns = toColumns(attribute.dataType, value);

      inputs.push({
        productId: product.props.id!,
        attributeId: attribute.id,
        scope,
        ...targets,
        columns,
      });
      changedCodes.push(item.attributeCode);
    }

    await this.store.upsertScopedValues(inputs);

    // Same over-invalidation rationale as AssignAttributeValue (singular): simpler
    // and safer to invalidate every store-view's cached PDP than to compute exactly
    // which ones a WEBSITE/STORE/STORE_VIEW-scoped subset of these changes affects.
    await this.cache.invalidatePrefix(pdpCachePrefix(cmd.productPublicId));

    await this.outbox.write({
      aggregateType: 'Product',
      aggregateId: cmd.productPublicId,
      eventType: 'ProductAttributesChanged',
      payload: { attributeCodes: changedCodes },
    });
  }
}
