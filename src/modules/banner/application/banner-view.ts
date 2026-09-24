import type { BannerRecord } from '../domain/repositories.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { BannerView } from './dto.js';

/** A banner image is normally an uploaded file (`imageMediaKey` is its storage key, presigned
 *  fresh on every read). It may instead hold a full https:// address — used by the starter
 *  banners seeded to match the storefront's built-in stock photos — which is returned as-is. */
const isExternalImage = (key: string) => /^https:\/\//i.test(key);

/** Async since it resolves a live presigned imageUrl — same pattern as
 *  catalog's category-view.ts / store's website-view.ts. */
export async function toBannerView(b: BannerRecord): Promise<BannerView> {
  return {
    publicId: b.publicId,
    group: b.group,
    title: b.title,
    subtitle: b.subtitle,
    imageMediaKey: b.imageMediaKey,
    imageUrl: b.imageMediaKey ? (isExternalImage(b.imageMediaKey) ? b.imageMediaKey : await presignGetUrl(b.imageMediaKey)) : null,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    gradient: b.gradient,
    position: b.position,
    isActive: b.isActive,
    updatedAt: b.updatedAt.toISOString(),
  };
}
