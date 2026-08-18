import { api } from '@/lib/axios';
import type { RedeemGiftCardResult } from '@/types/wallet';
import type { RedeemLoyaltyPointsResult } from '@/types/loyalty';
import type { AttachReferralResult } from '@/types/referral';

/** Client Component mutations only — via same-origin /api Route Handlers, matching customer.service.ts's convention. */
export async function redeemGiftCard(code: string): Promise<RedeemGiftCardResult> {
  const res = await api.post<RedeemGiftCardResult>('/account/wallet/redeem-gift-card', { code });
  return res.data;
}

export async function redeemLoyaltyPoints(points: string): Promise<RedeemLoyaltyPointsResult> {
  const res = await api.post<RedeemLoyaltyPointsResult>('/account/loyalty/redeem', { points });
  return res.data;
}

/** Called post-registration/post-login with a captured ?ref= code — a bad/expired code
 *  must never block the caller, so this is always wrapped in a try/catch at the call site. */
export async function attachReferral(code: string): Promise<AttachReferralResult> {
  const res = await api.post<AttachReferralResult>('/account/referrals/attach', { code });
  return res.data;
}
