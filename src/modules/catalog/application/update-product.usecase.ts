import type { ProductRepository, BrandRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { toView } from './create-product.usecase.js';
import type { UpdateProductCommand, ProductView } from './dto.js';

function parseNumericId(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`invalid ${field}`, [{ path: field, message: 'expected numeric id' }]);
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
  constructor(
    private readonly products: ProductRepository,
    private readonly brands: BrandRepository,
  ) {}

  async execute(cmd: UpdateProductCommand): Promise<ProductView> {
    const existing = await this.products.findByPublicId(cmd.publicId);
    if (!existing) throw new NotFoundError('Product', cmd.publicId);

    let brandId: bigint | null | undefined;
    if (cmd.brandId !== undefined) {
      if (cmd.brandId === null) {
        brandId = null;
      } else {
        const brand = await this.brands.findByPublicId(cmd.brandId);
        if (!brand) throw new NotFoundError('brand', cmd.brandId);
        brandId = brand.id;
      }
    }

    const updated = await this.products.update(cmd.publicId, {
      nameDefault: cmd.nameDefault,
      status: cmd.status,
      visibility: cmd.visibility,
      weight: cmd.weight,
      attributeSetId: cmd.attributeSetId !== undefined ? parseNumericId(cmd.attributeSetId, 'attributeSetId') : undefined,
      brandId,
      taxClassId: cmd.taxClassId !== undefined ? (cmd.taxClassId === null ? null : parseNumericId(cmd.taxClassId, 'taxClassId')) : undefined,
      hsnCode: cmd.hsnCode,
    });
    return toView(updated);
  }
}
