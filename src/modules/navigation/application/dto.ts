import type { MegaMenuColumn, MegaMenuPromoImagePosition } from '../domain/repositories.js';

export interface CreateMegaMenuItemCommand {
  label: string;
  href: string;
  position?: number;
  isActive?: boolean;
  columns?: MegaMenuColumn[];
  promoImageMediaKey?: string | null;
  promoHref?: string | null;
  promoCaption?: string | null;
  panelWidth?: number | null;
  columnGap?: number | null;
  promoImageWidth?: number | null;
  promoImageHeight?: number | null;
  promoImagePosition?: MegaMenuPromoImagePosition;
}

export interface UpdateMegaMenuItemCommand {
  publicId: string;
  label?: string;
  href?: string;
  position?: number;
  isActive?: boolean;
  columns?: MegaMenuColumn[];
  promoImageMediaKey?: string | null;
  promoHref?: string | null;
  promoCaption?: string | null;
  panelWidth?: number | null;
  columnGap?: number | null;
  promoImageWidth?: number | null;
  promoImageHeight?: number | null;
  promoImagePosition?: MegaMenuPromoImagePosition;
}

export interface MegaMenuItemView {
  publicId: string;
  label: string;
  href: string;
  position: number;
  isActive: boolean;
  columns: MegaMenuColumn[];
  promoImageMediaKey: string | null;
  /** Presigned GET URL for promoImageMediaKey, resolved live on every
   *  read (same pattern as BannerView.imageUrl) — null when no image is
   *  set. */
  promoImageUrl: string | null;
  promoHref: string | null;
  promoCaption: string | null;
  /** Layout controls — see navigation.prisma's own doc comment: null
   *  means "use the component's own default," not zero. */
  panelWidth: number | null;
  columnGap: number | null;
  promoImageWidth: number | null;
  promoImageHeight: number | null;
  promoImagePosition: MegaMenuPromoImagePosition;
  updatedAt: string;
}

export interface RequestMegaMenuImageUploadCommand {
  filename: string;
  mimeType: string;
}

export interface MegaMenuImageUploadUrl {
  uploadUrl: string;
  imageMediaKey: string;
}
