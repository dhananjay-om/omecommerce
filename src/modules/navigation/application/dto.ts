import type { MegaMenuColumn } from '../domain/repositories.js';

export interface CreateMegaMenuItemCommand {
  label: string;
  href: string;
  position?: number;
  isActive?: boolean;
  columns?: MegaMenuColumn[];
  promoImageMediaKey?: string | null;
  promoHref?: string | null;
  promoCaption?: string | null;
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
