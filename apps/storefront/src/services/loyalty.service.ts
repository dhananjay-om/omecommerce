import 'server-only';
import { apiGet, buildQuery } from '@/lib/api-client';
import { STORE_VIEW_ID } from '@/lib/config';
import type { LoyaltyAccount, LoyaltyTransaction, PublicLoyaltyProgram } from '@/types/loyalty';

/** Server Component reads only. */
export function getMyLoyaltyAccount(): Promise<LoyaltyAccount> {
  return apiGet<LoyaltyAccount>('/store/v1/me/loyalty', { auth: true });
}

export function getMyLoyaltyTransactions(): Promise<LoyaltyTransaction[]> {
  return apiGet<LoyaltyTransaction[]>('/store/v1/me/loyalty/transactions', { auth: true });
}

/**
 * Public — no `auth`, resolved by this deployment's storeViewId rather than
 * the customer. Returns 404 when this website has no ACTIVE loyalty program;
 * callers should treat that as "no rewards program" rather than an error.
 */
export function getLoyaltyProgram(): Promise<PublicLoyaltyProgram> {
  return apiGet<PublicLoyaltyProgram>(`/store/v1/loyalty/program${buildQuery({ storeViewId: STORE_VIEW_ID })}`);
}
