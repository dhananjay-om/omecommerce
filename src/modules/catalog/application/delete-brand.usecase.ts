import type { BrandRepository } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';

/** Soft-delete, guarded: rejects a brand that still has products assigned. */
export class DeleteBrand {
  constructor(private readonly brands: BrandRepository) {}

  async execute(publicId: string): Promise<void> {
    const brand = await this.brands.findByPublicId(publicId);
    if (!brand) throw new NotFoundError('brand', publicId);

    if (await this.brands.hasProducts(brand.id)) {
      throw new ConflictError('cannot delete a brand that has products assigned');
    }
    await this.brands.softDelete(brand.id);
  }
}
