import type { CategoryRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toCategoryView } from './category-view.js';
import type { UpdateCategoryCommand, CategoryView } from './dto.js';

/** Scalar-field updates only (name/sortMode/position) — moving a category through the tree goes through ReparentCategory. */
export class UpdateCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(cmd: UpdateCategoryCommand): Promise<CategoryView> {
    const existing = await this.categories.findByPublicId(cmd.publicId);
    if (!existing) throw new NotFoundError('category', cmd.publicId);
    const updated = await this.categories.update(existing.id, {
      nameDefault: cmd.nameDefault,
      sortMode: cmd.sortMode,
      position: cmd.position,
    });
    return toCategoryView(updated);
  }
}
