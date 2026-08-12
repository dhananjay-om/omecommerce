import type { BrandInfo } from '../domain/repositories.js';
import type { BrandView } from './dto.js';

export function toBrandView(b: BrandInfo): BrandView {
  return {
    publicId: b.publicId,
    slug: b.slug,
    name: b.name,
    description: b.description,
    createdAt: b.createdAt.toISOString(),
  };
}
