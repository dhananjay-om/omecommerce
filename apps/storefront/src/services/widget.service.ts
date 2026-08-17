import 'server-only';
import { apiGet, buildQuery } from '@/lib/api-client';

export type WidgetType =
  | 'CMS_BLOCK'
  | 'HERO_BANNER_SLIDER'
  | 'PROMO_BANNER_GRID'
  | 'CATEGORY_GRID'
  | 'BRAND_GRID'
  | 'WHY_CHOOSE_US_LIST'
  | 'TESTIMONIAL_LIST';

export type WidgetSection = 'TOP' | 'MIDDLE' | 'FOOTER';

export interface WidgetInstance {
  publicId: string;
  type: WidgetType;
  page: string;
  section: WidgetSection;
  position: number;
  title: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
  updatedAt: string;
}

/** Server Component reads only — direct to Express, same pattern as content.service.ts.
 *  Active widgets for one page+section, ordered by position. */
export function listWidgets(page: string, section: WidgetSection): Promise<WidgetInstance[]> {
  return apiGet<WidgetInstance[]>(`/store/v1/widgets${buildQuery({ page, section })}`);
}
