'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { Coupon, CouponDiscountType } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/** <input type="date"> gives "YYYY-MM-DD"; the backend's startsAt/endsAt fields require a
 *  full ISO datetime (z.string().datetime(), same convention as PriceList/GiftCard's own
 *  startsAt/endsAt/expiresAt) — this is the one conversion step in between. */
function toIsoOrUndefined(dateOnly: FormDataEntryValue | null): string | undefined {
  if (typeof dateOnly !== 'string' || !dateOnly) return undefined;
  const parsed = new Date(dateOnly);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export async function createCoupon(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const discountType = String(formData.get('discountType') ?? '') as CouponDiscountType;
  const value = String(formData.get('value') ?? '').trim();
  const currencyRaw = String(formData.get('currency') ?? '').trim();
  const minSubtotalRaw = String(formData.get('minSubtotal') ?? '').trim();
  const usageLimitRaw = String(formData.get('usageLimit') ?? '').trim();
  const usageLimitPerCustomerRaw = String(formData.get('usageLimitPerCustomer') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code || !discountType || !value) {
    return { error: 'Code, discount type, and value are required.', success: false };
  }

  try {
    await apiPost<Coupon>('/admin/v1/coupons', {
      code,
      description: description || undefined,
      discountType,
      value,
      currency: discountType === 'FIXED_AMOUNT' ? currencyRaw.toUpperCase() || undefined : undefined,
      minSubtotal: minSubtotalRaw || undefined,
      usageLimit: usageLimitRaw ? Number(usageLimitRaw) : undefined,
      usageLimitPerCustomer: usageLimitPerCustomerRaw ? Number(usageLimitPerCustomerRaw) : undefined,
      startsAt: toIsoOrUndefined(formData.get('startsAt')),
      endsAt: toIsoOrUndefined(formData.get('endsAt')),
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/coupons');
  return { error: null, success: true };
}

export async function updateCoupon(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const discountType = String(formData.get('discountType') ?? '') as CouponDiscountType;
  const value = String(formData.get('value') ?? '').trim();
  const currencyRaw = String(formData.get('currency') ?? '').trim();
  const minSubtotalRaw = String(formData.get('minSubtotal') ?? '').trim();
  const usageLimitRaw = String(formData.get('usageLimit') ?? '').trim();
  const usageLimitPerCustomerRaw = String(formData.get('usageLimitPerCustomer') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code) return { error: 'Missing coupon code.', success: false };

  try {
    await apiPatch<Coupon>(`/admin/v1/coupons/${code}`, {
      description: description || null,
      discountType: discountType || undefined,
      value: value || undefined,
      currency: discountType === 'FIXED_AMOUNT' ? currencyRaw.toUpperCase() || undefined : null,
      minSubtotal: minSubtotalRaw || null,
      usageLimit: usageLimitRaw ? Number(usageLimitRaw) : null,
      usageLimitPerCustomer: usageLimitPerCustomerRaw ? Number(usageLimitPerCustomerRaw) : null,
      startsAt: toIsoOrUndefined(formData.get('startsAt')) ?? null,
      endsAt: toIsoOrUndefined(formData.get('endsAt')) ?? null,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/coupons');
  return { error: null, success: true };
}

export async function deleteCoupon(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) return { error: 'Missing coupon code.', success: false };

  try {
    await apiDelete(`/admin/v1/coupons/${code}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/coupons');
  return { error: null, success: true };
}
