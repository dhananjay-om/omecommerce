import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { MegaMenuItem } from '@/types/mega-menu';
import type { TopBar } from '@/types/top-bar';

/** Server Component read only, public/unauthenticated — same tier as
 *  listCategories(). Empty when the admin hasn't configured any items
 *  yet (see mega-menu.tsx's own doc comment on the fallback that
 *  triggers). */
export async function getMegaMenuItems(): Promise<MegaMenuItem[]> {
  return apiGet<MegaMenuItem[]>('/store/v1/navigation/mega-menu');
}

/** The thin strip above the header — per website, so the India and US stores
 *  can differ. Throws on a network/API error; the caller falls back to a built-in default. */
export async function getTopBar(websiteCode: string): Promise<TopBar> {
  return apiGet<TopBar>(`/store/v1/navigation/top-bar?websiteCode=${encodeURIComponent(websiteCode)}`);
}
