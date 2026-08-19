import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { CustomerAddress } from '@/types/customer';

/** Server Component reads only — same shape as company.service.ts's getMyCompanyCredit(). */
export function getMyAddresses(): Promise<CustomerAddress[]> {
  return apiGet<CustomerAddress[]>('/store/v1/me/addresses', { auth: true });
}
