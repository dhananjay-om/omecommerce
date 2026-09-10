import type { MegaMenuItemRecord } from '../domain/repositories.js';
import { presignGetUrl } from '../../../shared/infrastructure/storage/s3-client.js';
import type { MegaMenuItemView } from './dto.js';

/** Async since it resolves a live presigned promoImageUrl — same pattern
 *  as banner/application/banner-view.ts's toBannerView. */
export async function toMegaMenuItemView(item: MegaMenuItemRecord): Promise<MegaMenuItemView> {
  return {
    publicId: item.publicId,
    label: item.label,
    href: item.href,
    position: item.position,
    isActive: item.isActive,
    columns: item.columns,
    promoImageMediaKey: item.promoImageMediaKey,
    promoImageUrl: item.promoImageMediaKey ? await presignGetUrl(item.promoImageMediaKey) : null,
    promoHref: item.promoHref,
    promoCaption: item.promoCaption,
    panelWidth: item.panelWidth,
    columnGap: item.columnGap,
    promoImageWidth: item.promoImageWidth,
    promoImageHeight: item.promoImageHeight,
    promoImagePosition: item.promoImagePosition,
    updatedAt: item.updatedAt.toISOString(),
  };
}
