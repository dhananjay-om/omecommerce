import 'server-only';
import { apiGet, buildQuery } from '@/lib/api-client';
import { STORE_VIEW_ID } from '@/lib/config';
import type { MyReferrals, PublicReferralProgram } from '@/types/referral';

/** Server Component reads only. */
export function getMyReferrals(): Promise<MyReferrals> {
  return apiGet<MyReferrals>('/store/v1/me/referrals', { auth: true });
}

/**
 * Public — no `auth`, resolved by this deployment's storeViewId. Returns 404
 * when this website has no ACTIVE referral program; callers should treat
 * that as "no referral offer" rather than an error.
 */
export function getReferralProgram(): Promise<PublicReferralProgram> {
  return apiGet<PublicReferralProgram>(`/store/v1/referral/program${buildQuery({ storeViewId: STORE_VIEW_ID })}`);
}
