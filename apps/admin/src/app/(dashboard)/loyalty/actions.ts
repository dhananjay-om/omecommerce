'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { LoyaltyProgram, LoyaltyTier } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/**
 * One form, two outcomes — mirrors the "one settings card per website" shape
 * of stores/gst-settings, except LoyaltyProgram is a resource that may not
 * exist yet for a given website. A hidden `mode` field (set by the form
 * component, not the user) picks create vs update; `programPublicId` is only
 * present in update mode.
 */
export async function saveLoyaltyProgram(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const mode = String(formData.get('mode') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const pointsPerCurrencyUnit = String(formData.get('pointsPerCurrencyUnit') ?? '').trim();
  const pointValue = String(formData.get('pointValue') ?? '').trim();
  const redeemMinPointsRaw = String(formData.get('redeemMinPoints') ?? '').trim();
  const pointsExpiryMonthsRaw = String(formData.get('pointsExpiryMonths') ?? '').trim();

  if (!name) return { error: 'Name is required.', success: false };
  if (!pointsPerCurrencyUnit) return { error: 'Points per currency unit is required.', success: false };
  if (!pointValue) return { error: 'Point value is required.', success: false };

  const redeemMinPoints = redeemMinPointsRaw ? Number(redeemMinPointsRaw) : undefined;
  const pointsExpiryMonths = pointsExpiryMonthsRaw ? Number(pointsExpiryMonthsRaw) : null;

  try {
    if (mode === 'create') {
      const websiteCode = String(formData.get('websiteCode') ?? '').trim();
      if (!websiteCode) return { error: 'Missing website code.', success: false };
      await apiPost<LoyaltyProgram>('/admin/v1/loyalty/programs', {
        websiteCode,
        name,
        pointsPerCurrencyUnit,
        pointValue,
        redeemMinPoints,
        pointsExpiryMonths,
      });
    } else {
      const programPublicId = String(formData.get('programPublicId') ?? '').trim();
      const status = String(formData.get('status') ?? '').trim();
      if (!programPublicId) return { error: 'Missing program id.', success: false };
      await apiPatch<LoyaltyProgram>(`/admin/v1/loyalty/programs/${programPublicId}`, {
        name,
        pointsPerCurrencyUnit,
        pointValue,
        redeemMinPoints,
        pointsExpiryMonths,
        status: status || undefined,
      });
    }
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/loyalty');
  return { error: null, success: true };
}

export async function createLoyaltyTier(programPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const thresholdPoints = String(formData.get('thresholdPoints') ?? '').trim();
  const earnMultiplier = String(formData.get('earnMultiplier') ?? '').trim();
  const sortOrderRaw = String(formData.get('sortOrder') ?? '').trim();

  if (!name) return { error: 'Name is required.', success: false };
  if (!thresholdPoints) return { error: 'Threshold points is required.', success: false };

  try {
    await apiPost<LoyaltyTier>(`/admin/v1/loyalty/programs/${programPublicId}/tiers`, {
      name,
      thresholdPoints,
      earnMultiplier: earnMultiplier || undefined,
      sortOrder: sortOrderRaw ? Number(sortOrderRaw) : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/loyalty');
  return { error: null, success: true };
}

export async function updateLoyaltyTier(
  programPublicId: string,
  tierId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const thresholdPoints = String(formData.get('thresholdPoints') ?? '').trim();
  const earnMultiplier = String(formData.get('earnMultiplier') ?? '').trim();
  const sortOrderRaw = String(formData.get('sortOrder') ?? '').trim();

  if (!name) return { error: 'Name is required.', success: false };
  if (!thresholdPoints) return { error: 'Threshold points is required.', success: false };

  try {
    await apiPatch<LoyaltyTier>(`/admin/v1/loyalty/programs/${programPublicId}/tiers/${tierId}`, {
      name,
      thresholdPoints,
      earnMultiplier: earnMultiplier || undefined,
      sortOrder: sortOrderRaw ? Number(sortOrderRaw) : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/loyalty');
  return { error: null, success: true };
}

export async function deleteLoyaltyTier(programPublicId: string, tierId: string, _prevState: ActionState): Promise<ActionState> {
  try {
    await apiDelete<void>(`/admin/v1/loyalty/programs/${programPublicId}/tiers/${tierId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/loyalty');
  return { error: null, success: true };
}
