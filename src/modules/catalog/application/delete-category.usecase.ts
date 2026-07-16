import type { CategoryRepository } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';

/** Soft-delete, guarded: rejects a category that still has children or assigned products. Cascading soft-delete is real, separate future work. */
export class DeleteCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(publicId: string): Promise<void> {
    const category = await this.categories.findByPublicId(publicId);
    if (!category) throw new NotFoundError('category', publicId);

    if (await this.categories.hasChildren(category.id)) {
      throw new ConflictError('cannot delete a category that has child categories');
    }
    if (await this.categories.hasProducts(category.id)) {
      throw new ConflictError('cannot delete a category that has products assigned');
    }
    await this.categories.softDelete(category.id);
  }
}
