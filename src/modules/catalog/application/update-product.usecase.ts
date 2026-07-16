import type { ProductRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { toView } from './create-product.usecase.js';
import type { UpdateProductCommand, ProductView } from './dto.js';

function parseAttributeSetId(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError('invalid attributeSetId', [{ path: 'attributeSetId', message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

/**
 * Patch semantics: only fields present in the command are touched. SKU and
 * `type` are deliberately not editable here (matches Magento; changing type
 * after creation would invalidate the implicit-variant assumptions
 * PrismaProductRepository.create() made at creation time).
 */
export class UpdateProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(cmd: UpdateProductCommand): Promise<ProductView> {
    const existing = await this.products.findByPublicId(cmd.publicId);
    if (!existing) throw new NotFoundError('Product', cmd.publicId);

    const updated = await this.products.update(cmd.publicId, {
      nameDefault: cmd.nameDefault,
      status: cmd.status,
      visibility: cmd.visibility,
      weight: cmd.weight,
      attributeSetId: cmd.attributeSetId !== undefined ? parseAttributeSetId(cmd.attributeSetId) : undefined,
    });
    return toView(updated);
  }
}
