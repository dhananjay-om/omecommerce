import type { CategoryRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toCategoryView } from './category-view.js';
import type { CategoryBreadcrumbView } from './dto.js';

/** Storefront category page (plan/14 Phase 0a) — the category plus its root-first ancestor chain for a breadcrumb. */
export class GetCategoryBySlug {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(slug: string): Promise<CategoryBreadcrumbView> {
    const category = await this.categories.findBySlug(slug);
    if (!category) throw new NotFoundError('category', slug);

    const ancestors = await this.categories.getAncestors(category.id);
    return {
      category: toCategoryView(category),
      breadcrumb: ancestors.map(toCategoryView),
    };
  }
}
