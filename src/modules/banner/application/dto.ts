import type { BannerGroup } from '@prisma/client';

export interface CreateBannerCommand {
  group: BannerGroup;
  title: string;
  subtitle?: string | null;
  imageMediaKey?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  position?: number;
  isActive?: boolean;
}

export interface UpdateBannerCommand {
  publicId: string;
  title?: string;
  subtitle?: string | null;
  imageMediaKey?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  position?: number;
  isActive?: boolean;
}

export interface BannerView {
  publicId: string;
  group: BannerGroup;
  title: string;
  subtitle: string | null;
  imageMediaKey: string | null;
  /** Presigned GET URL for imageMediaKey, resolved live on every read (15-minute
   *  expiry, same pattern as CategoryView.imageUrl/WebsiteView.logoUrl) — null when no image is set. */
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  position: number;
  isActive: boolean;
  updatedAt: string;
}

export interface RequestBannerImageUploadCommand {
  group: BannerGroup;
  filename: string;
  mimeType: string;
}

export interface BannerImageUploadUrl {
  uploadUrl: string;
  imageMediaKey: string;
}
