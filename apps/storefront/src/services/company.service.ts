import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { MyCompany, CompanyMember } from '@/types/company';

/** Server Component reads only — a customer with no company membership gets `{ company: null }`, not a 404 (this is a normal state, see MyCompany's doc comment). */
export function getMyCompany(): Promise<MyCompany> {
  return apiGet<MyCompany>('/store/v1/me/company', { auth: true });
}

/** Only meaningful when getMyCompany().myRole === 'ADMIN' — a BUYER-role member gets a 403 from the backend if called anyway. */
export function getMyCompanyMembers(): Promise<CompanyMember[]> {
  return apiGet<CompanyMember[]>('/store/v1/me/company/members', { auth: true });
}
