import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { MegaMenuItem } from '@/types/mega-menu';

/** Server Component read only, public/unauthenticated — same tier as
 *  listCategories(). Empty when the admin hasn't configured any items
 *  yet (see mega-menu.tsx's own doc comment on the fallback that
 *  triggers). */
export async function getMegaMenuItems(): Promise<MegaMenuItem[]> {
  return apiGet<MegaMenuItem[]>('/store/v1/navigation/mega-menu');
}
