import { Product } from '../domain/product.js';
import type { ProductRepository, AttributeRepository, ProductAttributeStore } from '../domain/repositories.js';
import { toColumns } from '../domain/attribute-value.js';
import { ConflictError, ValidationError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import { uniqueSlug } from './slugify.js';
import { URL_KEY_ATTRIBUTE_CODE, RESERVED_SLUGS } from './url-key.js';
import type { CreateProductCommand, ProductView } from './dto.js';

function parseId(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`invalid ${field}`, [{ path: field, message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

export class CreateProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly outbox: OutboxWriter,
    private readonly attributes: AttributeRepository,
    private readonly store: ProductAttributeStore,
  ) {}

  async execute(cmd: CreateProductCommand): Promise<ProductView> {
    if (await this.products.existsBySku(cmd.sku.trim())) {
      throw new ConflictError(`sku already exists: ${cmd.sku}`);
    }
    const slug = await uniqueSlug(
      (s) => (RESERVED_SLUGS.has(s) ? Promise.resolve(true) : this.products.findBySlug(s)),
      cmd.nameDefault,
      cmd.sku,
    );
    const product = Product.create({
      type: cmd.type,
      sku: cmd.sku,
      slug,
      attributeSetId: parseId(cmd.attributeSetId, 'attributeSetId'),
      status: cmd.status,
      visibility: cmd.visibility,
      nameDefault: cmd.nameDefault ?? null,
      weight: cmd.weight ?? null,
      taxClassId: cmd.taxClassId ? parseId(cmd.taxClassId, 'taxClassId') : null,
      hsnCode: cmd.hsnCode ?? null,
      tags: cmd.tags,
    });
    const saved = await this.products.create(product);

    // Auto-fills the admin's "URL Key" SEO field with the same value Product.slug
    // just got — same "generate it, but let the admin see/edit it in one obvious
    // place" behavior Magento's url_key has. Best-effort: a fresh/non-seeded DB
    // missing the url_key Attribute row must never block product creation itself.
    const urlKeyAttribute = await this.attributes.findByCode(URL_KEY_ATTRIBUTE_CODE);
    if (urlKeyAttribute) {
      await this.store.upsertScopedValue({
        productId: saved.props.id!,
        attributeId: urlKeyAttribute.id,
        scope: 'GLOBAL',
        websiteId: null,
        storeId: null,
        storeViewId: null,
        columns: toColumns(urlKeyAttribute.dataType, slug),
      });
    }

    // Catalog's first outbox event (Stage 4) — consumed by the search indexer.
    // Not written in the same transaction as product.create() (that repository
    // call is a single-statement insert, not a multi-step transaction like
    // Order's) — an immediate follow-up write, same documented trade-off as
    // Order's non-OrderPlaced events.
    await this.outbox.write({
      aggregateType: 'Product',
      aggregateId: saved.props.publicId!,
      eventType: 'ProductCreated',
      payload: { sku: saved.props.sku },
    });
    return toView(saved);
  }
}

export function toView(product: Product): ProductView {
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
    taxClassId: p.taxClassId?.toString() ?? null,
    hsnCode: p.hsnCode,
    tags: p.tags,
  };
}
