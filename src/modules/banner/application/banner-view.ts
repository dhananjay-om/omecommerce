import type { BannerRecord } from '../domain/repositories.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { BannerView } from './dto.js';

/** Async since it resolves a live presigned imageUrl — same pattern as
 *  catalog's category-view.ts / store's website-view.ts. */
export async function toBannerView(b: BannerRecord): Promise<BannerView> {
  return {
    publicId: b.publicId,
    group: b.group,
    title: b.title,
    subtitle: b.subtitle,
    imageMediaKey: b.imageMediaKey,
    imageUrl: b.imageMediaKey ? await presignGetUrl(b.imageMediaKey) : null,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    position: b.position,
    isActive: b.isActive,
    updatedAt: b.updatedAt.toISOString(),
  };
}
