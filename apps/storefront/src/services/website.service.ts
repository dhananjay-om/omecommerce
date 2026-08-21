import 'server-only';
import { apiGet } from '@/lib/api-client';
import { WEBSITE_CODE } from '@/lib/config';
import type { Website } from '@/types/website';

/** Server Component reads only — direct to Express. Public branding
 *  (name/logo) for the header/footer; admin-configured via Stores >
 *  General Settings > Store Logo. */
export function getWebsite(): Promise<Website> {
  return apiGet<Website>(`/store/v1/website?code=${WEBSITE_CODE}`);
}
