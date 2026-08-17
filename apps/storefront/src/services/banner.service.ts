import 'server-only';
import { apiGet, buildQuery } from '@/lib/api-client';

export type BannerGroup = 'HERO' | 'PROMO';

export interface BannerRecord {
  publicId: string;
  group: BannerGroup;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  position: number;
  isActive: boolean;
}

/** Server Component reads only — active banners of one group, ordered by position. */
export function listBanners(group: BannerGroup): Promise<BannerRecord[]> {
  return apiGet<BannerRecord[]>(`/store/v1/banners${buildQuery({ group })}`);
}
