import type { CategoryInfo } from '../domain/repositories.js';
import type { CategoryView } from './dto.js';

export function toCategoryView(c: CategoryInfo): CategoryView {
  return {
    publicId: c.publicId,
    parentId: c.parentPublicId,
    slug: c.slug,
    type: c.type,
    sortMode: c.sortMode,
    position: c.position,
    nameDefault: c.nameDefault,
    createdAt: c.createdAt.toISOString(),
  };
}
