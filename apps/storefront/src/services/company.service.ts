import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { MyCompany, CompanyMember, MyCompanyCredit } from '@/types/company';

/** Server Component reads only — a customer with no company membership gets `{ company: null }`, not a 404 (this is a normal state, see MyCompany's doc comment). */
export function getMyCompany(): Promise<MyCompany> {
  return apiGet<MyCompany>('/store/v1/me/company', { auth: true });
}

/** Only meaningful when getMyCompany().myRole === 'ADMIN' — a BUYER-role member gets a 403 from the backend if called anyway. */
export function getMyCompanyMembers(): Promise<CompanyMember[]> {
  return apiGet<CompanyMember[]>('/store/v1/me/company/members', { auth: true });
}

/** plan/15 Phase 7 — B2B Net-X credit terms. `account: null` covers every non-eligible state (no company, company not Active, no credit terms configured) uniformly — the checkout page and /account/company/credit both just check for a non-null account before offering "pay on account." */
export function getMyCompanyCredit(): Promise<MyCompanyCredit> {
  return apiGet<MyCompanyCredit>('/store/v1/me/company/credit', { auth: true });
}
