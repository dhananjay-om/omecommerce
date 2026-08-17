import type { CategoryInfo } from '../domain/repositories.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { CategoryView } from './dto.js';

/** Async since it now resolves a live presigned imageUrl (never
 *  cached/stored, same pattern as the store module's website-view.ts). */
export async function toCategoryView(c: CategoryInfo): Promise<CategoryView> {
  return {
    publicId: c.publicId,
    parentId: c.parentPublicId,
    slug: c.slug,
    type: c.type,
    sortMode: c.sortMode,
    position: c.position,
    nameDefault: c.nameDefault,
    description: c.description,
    imageMediaKey: c.imageMediaKey,
    imageUrl: c.imageMediaKey ? await presignGetUrl(c.imageMediaKey) : null,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    metaKeywords: c.metaKeywords,
    includeInMenu: c.includeInMenu,
    createdAt: c.createdAt.toISOString(),
  };
}
