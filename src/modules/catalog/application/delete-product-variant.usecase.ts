import type { ProductVariantRepository } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';

/** Soft-delete, guarded: rejects a variant that still has non-zero stock anywhere — adjust its
 * stock to zero first, same shape as DeleteProduct/DeleteWarehouse's guards. Lets an admin undo a
 * bad "Generate Variants" run (e.g. wrong option selected) without touching the others. */
export class DeleteProductVariant {
  constructor(private readonly variants: ProductVariantRepository) {}

  async execute(variantPublicId: string): Promise<void> {
    const variant = await this.variants.findByPublicId(variantPublicId);
    if (!variant) throw new NotFoundError('variant', variantPublicId);

    if (await this.variants.hasStock(variant.id)) {
      throw new ConflictError('cannot delete a variant that still has stock — adjust its stock to zero first');
    }
    await this.variants.softDelete(variant.id);
  }
}
