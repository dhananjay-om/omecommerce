import type { BannerRepository } from '../domain/repositories.js';
import type { BannerGroup } from '@prisma/client';
import { toBannerView } from './banner-view.js';
import type { BannerView } from './dto.js';

/** Storefront read (used by the widget renderer's HERO_BANNER_SLIDER/
 *  PROMO_BANNER_GRID widget types) — active banners of one group, ordered by position. */
export class ListActiveBanners {
  constructor(private readonly banners: BannerRepository) {}

  async execute(group: BannerGroup): Promise<BannerView[]> {
    const rows = await this.banners.listActiveByGroup(group);
    return Promise.all(rows.map(toBannerView));
  }
}
