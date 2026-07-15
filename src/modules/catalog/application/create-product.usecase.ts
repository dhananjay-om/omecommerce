import { Product } from '../domain/product.js';
import type { ProductRepository } from '../domain/repositories.js';
import { ConflictError, ValidationError } from '../../../shared/domain/errors.js';
import type { CreateProductCommand, ProductView } from './dto.js';

function parseId(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`invalid ${field}`, [{ path: field, message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

export class CreateProduct {
  constructor(private readonly products: ProductRepository) {}

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
