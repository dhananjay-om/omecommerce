'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, ApiError } from '@/lib/api-client';
import type { ReferralProgram } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/**
 * One form, two outcomes — same create-or-edit shape as loyalty's
 * saveLoyaltyProgram. The reward-shape and POINTS-needs-a-loyalty-program
 * invariants are re-checked here defensively, but the client-side form
 * (referral-program-form.tsx) is what actually surfaces a plain-English
 * error before the request is even sent — this is only the last line of
 * defense once it reaches the API.
 */
export async function saveReferralProgram(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const mode = String(formData.get('mode') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const qualifyingEvent = String(formData.get('qualifyingEvent') ?? '').trim();
  const minOrderAmount = String(formData.get('minOrderAmount') ?? '').trim();
  const referrerRewardType = String(formData.get('referrerRewardType') ?? '').trim();
  const referrerRewardAmount = String(formData.get('referrerRewardAmount') ?? '').trim();
  const referrerRewardPoints = String(formData.get('referrerRewardPoints') ?? '').trim();
  const refereeRewardType = String(formData.get('refereeRewardType') ?? '').trim();
  const refereeRewardAmount = String(formData.get('refereeRewardAmount') ?? '').trim();
  const refereeRewardPoints = String(formData.get('refereeRewardPoints') ?? '').trim();
  const maxReferralsRaw = String(formData.get('maxReferralsPerCustomer') ?? '').trim();
  const attributionWindowRaw = String(formData.get('attributionWindowDays') ?? '').trim();

  if (!name) return { error: 'Name is required.', success: false };

  const body = {
    name,
    qualifyingEvent: qualifyingEvent || undefined,
    minOrderAmount: minOrderAmount || null,
    referrerRewardType,
    referrerRewardAmount: referrerRewardType === 'STORE_CREDIT' ? referrerRewardAmount || null : null,
    referrerRewardPoints: referrerRewardType === 'POINTS' ? referrerRewardPoints || null : null,
    refereeRewardType,
    refereeRewardAmount: refereeRewardType === 'STORE_CREDIT' ? refereeRewardAmount || null : null,
    refereeRewardPoints: refereeRewardType === 'POINTS' ? refereeRewardPoints || null : null,
    maxReferralsPerCustomer: maxReferralsRaw ? Number(maxReferralsRaw) : null,
    attributionWindowDays: attributionWindowRaw ? Number(attributionWindowRaw) : null,
  };

  try {
    if (mode === 'create') {
      const websiteCode = String(formData.get('websiteCode') ?? '').trim();
      if (!websiteCode) return { error: 'Missing website code.', success: false };
      await apiPost<ReferralProgram>('/admin/v1/referral/programs', { websiteCode, ...body });
    } else {
      const programPublicId = String(formData.get('programPublicId') ?? '').trim();
      const status = String(formData.get('status') ?? '').trim();
      if (!programPublicId) return { error: 'Missing program id.', success: false };
      await apiPatch<ReferralProgram>(`/admin/v1/referral/programs/${programPublicId}`, { ...body, status: status || undefined });
    }
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/referrals');
  return { error: null, success: true };
}
