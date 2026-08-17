import type { BannerGroup } from '@prisma/client';

export interface BannerRecord {
  publicId: string;
  group: BannerGroup;
  title: string;
  subtitle: string | null;
  imageMediaKey: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  position: number;
  isActive: boolean;
  updatedAt: Date;
}

export interface CreateBannerInput {
  group: BannerGroup;
  title: string;
  subtitle?: string | null;
  imageMediaKey?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  position?: number;
  isActive?: boolean;
}

export interface UpdateBannerInput {
  title?: string;
  subtitle?: string | null;
  imageMediaKey?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  position?: number;
  isActive?: boolean;
}

export interface BannerRepository {
  create(input: CreateBannerInput): Promise<BannerRecord>;
  findByPublicId(publicId: string): Promise<BannerRecord | null>;
  /** Admin browse — every non-deleted banner, newest-updated first. */
  list(): Promise<BannerRecord[]>;
  /** Storefront read — active banners of one group, ordered by position (plan/13-ish widget-fed section). */
  listActiveByGroup(group: BannerGroup): Promise<BannerRecord[]>;
  update(publicId: string, input: UpdateBannerInput): Promise<BannerRecord>;
  softDelete(publicId: string): Promise<void>;
}
