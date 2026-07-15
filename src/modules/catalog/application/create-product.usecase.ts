import { Product } from '../domain/product.js';
import type { ProductRepository } from '../domain/repositories.js';
import { ConflictError, ValidationError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
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
  ) {}

  async execute(cmd: CreateProductCommand): Promise<ProductView> {
    if (await this.products.existsBySku(cmd.sku.trim())) {
      throw new ConflictError(`sku already exists: ${cmd.sku}`);
    }
    const product = Product.create({
      type: cmd.type,
      sku: cmd.sku,
      attributeSetId: parseId(cmd.attributeSetId, 'attributeSetId'),
      status: cmd.status,
      visibility: cmd.visibility,
      nameDefault: cmd.nameDefault ?? null,
    });
    const saved = await this.products.create(product);
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
    type: p.type,
    status: p.status,
    visibility: p.visibility,
    name: p.nameDefault,
  };
}
