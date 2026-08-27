import 'server-only';
import { apiGet } from '@/lib/api-client';
import { getSelectedWebsiteCode } from '@/lib/store-context';
import type { Website } from '@/types/website';

/** Server Component reads only — direct to Express. Public branding
 *  (name/logo) for the header/footer; admin-configured via Stores >
 *  General Settings > Store Logo. */
export async function getWebsite(): Promise<Website> {
  const code = await getSelectedWebsiteCode();
  return apiGet<Website>(`/store/v1/website?code=${code}`);
}
