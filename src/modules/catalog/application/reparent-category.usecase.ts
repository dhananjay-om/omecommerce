import type { CategoryRepository } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import { toCategoryView } from './category-view.js';
import type { ReparentCategoryCommand, CategoryView } from './dto.js';

/**
 * Moves a category to a new parent (or to root) via the existing
 * `category_reparent` stored procedure, which rewrites the subtree's ltree
 * path and closure-table rows atomically. That procedure doesn't itself guard
 * against cycles, so this use-case checks for one first — moving a category
 * under one of its own descendants would otherwise silently corrupt the tree.
 */
export class ReparentCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(cmd: ReparentCategoryCommand): Promise<CategoryView> {
    const category = await this.categories.findByPublicId(cmd.publicId);
    if (!category) throw new NotFoundError('category', cmd.publicId);

    let newParentId: bigint | null = null;
    if (cmd.newParentId) {
      if (cmd.newParentId === cmd.publicId) {
        throw new ConflictError('a category cannot be its own parent');
      }
      const newParent = await this.categories.findByPublicId(cmd.newParentId);
      if (!newParent) throw new NotFoundError('category', cmd.newParentId);
      newParentId = newParent.id;
    }

    if (newParentId !== null && (await this.isDescendantOf(newParentId, category.id))) {
      throw new ConflictError('cannot move a category under one of its own descendants');
    }

    const moved = await this.categories.reparent(category.id, newParentId);
    return toCategoryView(moved);
  }

  /** Walks up from `candidateId` via parentId to see if it passes through `ancestorId`. Admin-scale tree, so an in-memory walk over the flat list is simpler than a recursive SQL query and just as correct. */
  private async isDescendantOf(candidateId: bigint, ancestorId: bigint): Promise<boolean> {
    const all = await this.categories.list();
    const byId = new Map(all.map((c) => [c.id.toString(), c]));
    let current = byId.get(candidateId.toString());
    while (current) {
      if (current.id === ancestorId) return true;
      current = current.parentId !== null ? byId.get(current.parentId.toString()) : undefined;
    }
    return false;
  }
}
