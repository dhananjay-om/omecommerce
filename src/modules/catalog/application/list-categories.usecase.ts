import type { CategoryRepository } from '../domain/repositories.js';
import { toCategoryView } from './category-view.js';
import type { CategoryView } from './dto.js';

/** Admin browse (plan/13 Phase K) — the full flat list; the tree is built client-side from `parentId`. */
export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(): Promise<CategoryView[]> {
    const rows = await this.categories.list();
    return Promise.all(rows.map(toCategoryView));
  }
}
