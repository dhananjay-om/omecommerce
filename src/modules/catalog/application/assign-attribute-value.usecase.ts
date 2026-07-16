import { ScopeType } from '@prisma/client';
import type { ProductRepository, AttributeRepository, ProductAttributeStore } from '../domain/repositories.js';
import { toColumns } from '../domain/attribute-value.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CacheAside } from '../../../shared/infrastructure/cache/cache-aside.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import { pdpCachePrefix } from './get-product-for-store-view.usecase.js';
import type { AssignAttributeValueCommand } from './dto.js';

export function parseId(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  if (!/^\d+$/.test(value)) throw new ValidationError('invalid id', [{ path: 'id', message: 'numeric' }]);
  return BigInt(value);
}

/** Resolve which scope target id must be present and null the others (plan/01 §1). Reused by AssignAttributeValues (plural). */
export function resolveScopeTargets(cmd: {
  scope: ScopeType;
  websiteId?: string | null;
  storeId?: string | null;
  storeViewId?: string | null;
}): {
  websiteId: bigint | null;
  storeId: bigint | null;
  storeViewId: bigint | null;
} {
  const website = parseId(cmd.websiteId);
  const store = parseId(cmd.storeId);
  const storeView = parseId(cmd.storeViewId);
  const require = (v: bigint | null, name: string): bigint => {
    if (v === null) throw new ValidationError(`${name} required for scope ${cmd.scope}`, [{ path: name, message: 'required' }]);
    return v;
  };
  switch (cmd.scope) {
    case ScopeType.GLOBAL:
      return { websiteId: null, storeId: null, storeViewId: null };
    case ScopeType.WEBSITE:
      return { websiteId: require(website, 'websiteId'), storeId: null, storeViewId: null };
    case ScopeType.STORE:
      return { websiteId: null, storeId: require(store, 'storeId'), storeViewId: null };
    case ScopeType.STORE_VIEW:
      return { websiteId: null, storeId: null, storeViewId: require(storeView, 'storeViewId') };
    default:
      throw new ValidationError('invalid scope', [{ path: 'scope', message: 'invalid' }]);
  }
}

export class AssignAttributeValue {
  constructor(
    private readonly products: ProductRepository,
    private readonly attributes: AttributeRepository,
    private readonly store: ProductAttributeStore,
    private readonly cache: CacheAside,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: AssignAttributeValueCommand): Promise<void> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product) throw new NotFoundError('Product', cmd.productPublicId);

    const attribute = await this.attributes.findByCode(cmd.attributeCode);
    if (!attribute) throw new NotFoundError('Attribute', cmd.attributeCode);

    const targets = resolveScopeTargets(cmd);
    const columns = toColumns(attribute.dataType, cmd.value);

    await this.store.upsertScopedValue({
      productId: product.props.id!,
      attributeId: attribute.id,
      scope: cmd.scope,
      ...targets,
      columns,
    });

    // Invalidate every store-view's cached PDP for this product — a GLOBAL-scope
    // change affects all of them, and it's simpler/safer to over-invalidate a
    // handful of Redis keys than to compute exactly which store views a
    // WEBSITE/STORE/STORE_VIEW-scoped change could affect.
    await this.cache.invalidatePrefix(pdpCachePrefix(cmd.productPublicId));

    await this.outbox.write({
      aggregateType: 'Product',
      aggregateId: cmd.productPublicId,
      eventType: 'ProductAttributeChanged',
      payload: { attributeCode: cmd.attributeCode, scope: cmd.scope },
    });
  }
}
