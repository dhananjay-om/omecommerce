import type { CategoryRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toCategoryView } from './category-view.js';
import { uniqueSlug } from './slugify.js';
import type { CreateCategoryCommand, CategoryView } from './dto.js';

export class CreateCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(cmd: CreateCategoryCommand): Promise<CategoryView> {
    let parentId: bigint | null = null;
    if (cmd.parentId) {
      const parent = await this.categories.findByPublicId(cmd.parentId);
      if (!parent) throw new NotFoundError('category', cmd.parentId);
      parentId = parent.id;
    }
    const slug = await uniqueSlug((s) => this.categories.findBySlug(s), cmd.nameDefault, 'category');
    const created = await this.categories.create({
      parentId,
      nameDefault: cmd.nameDefault,
      slug,
      type: cmd.type,
      sortMode: cmd.sortMode,
      position: cmd.position,
    });
    return toCategoryView(created);
  }
}
