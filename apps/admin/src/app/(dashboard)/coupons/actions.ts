'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import { resolveProductBySkuCascade } from '@/lib/resolve-product-by-sku';
import type { Coupon, CouponDiscountType, CouponTargetType } from '@/lib/types';
import type { ConditionRow } from './condition-builder';

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

/** ConditionBuilder submits one hidden JSON field carrying its whole working-row
 *  array (PRODUCT rows carry a typed `sku`, not yet a productId) — this resolves
 *  each row into the shape the backend's createCouponSchema/updateCouponSchema
 *  actually accepts. Throws a plain Error with a user-facing message on an
 *  unresolvable SKU, caught by the caller and surfaced as the form's error text. */
async function resolveConditionsField(formData: FormData): Promise<
  Array<{ conditionType: string; productId?: string; categoryId?: string; attributeCode?: string; attributeValue?: string }> | undefined
> {
  const raw = String(formData.get('conditionsJson') ?? '').trim();
  if (!raw) return undefined;
  const rows = JSON.parse(raw) as ConditionRow[];
  const resolved: Array<{ conditionType: string; productId?: string; categoryId?: string; attributeCode?: string; attributeValue?: string }> = [];
  for (const row of rows) {
    if (row.conditionType === 'PRODUCT') {
      const sku = row.sku.trim();
      if (!sku) continue;
      const product = await resolveProductBySkuCascade(sku);
      if (!product) throw new Error(`No product found for SKU "${sku}"`);
      resolved.push({ conditionType: 'PRODUCT', productId: product.publicId });
    } else if (row.conditionType === 'CATEGORY') {
      if (!row.categoryId) continue;
      resolved.push({ conditionType: 'CATEGORY', categoryId: row.categoryId });
    } else if (row.conditionType === 'ATTRIBUTE') {
      if (!row.attributeCode || !row.attributeValue) continue;
      resolved.push({ conditionType: 'ATTRIBUTE', attributeCode: row.attributeCode, attributeValue: row.attributeValue });
    }
  }
  return resolved;
}

export async function createCoupon(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const discountType = String(formData.get('discountType') ?? '') as CouponDiscountType;
  const value = String(formData.get('value') ?? '').trim();
  const currencyRaw = String(formData.get('currency') ?? '').trim();
  const minSubtotalRaw = String(formData.get('minSubtotal') ?? '').trim();
  const targetType = String(formData.get('targetType') ?? 'CART') as CouponTargetType;
  const isAutoApply = String(formData.get('isAutoApply') ?? 'false') === 'true';
  const usageLimitRaw = String(formData.get('usageLimit') ?? '').trim();
  const usageLimitPerCustomerRaw = String(formData.get('usageLimitPerCustomer') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code || !discountType || !value) {
    return { error: 'Code, discount type, and value are required.', success: false };
  }

  try {
    const conditions = targetType === 'ITEM' ? await resolveConditionsField(formData) : undefined;
    await apiPost<Coupon>('/admin/v1/coupons', {
      code,
      description: description || undefined,
      discountType,
      value,
      currency: discountType === 'FIXED_AMOUNT' ? currencyRaw.toUpperCase() || undefined : undefined,
      minSubtotal: minSubtotalRaw || undefined,
      targetType,
      isAutoApply,
      conditions,
      usageLimit: usageLimitRaw ? Number(usageLimitRaw) : undefined,
      usageLimitPerCustomer: usageLimitPerCustomerRaw ? Number(usageLimitPerCustomerRaw) : undefined,
      startsAt: toIsoOrUndefined(formData.get('startsAt')),
      endsAt: toIsoOrUndefined(formData.get('endsAt')),
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    if (err instanceof Error) return { error: err.message, success: false };
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
  const targetType = String(formData.get('targetType') ?? 'CART') as CouponTargetType;
  const isAutoApply = String(formData.get('isAutoApply') ?? 'false') === 'true';
  const usageLimitRaw = String(formData.get('usageLimit') ?? '').trim();
  const usageLimitPerCustomerRaw = String(formData.get('usageLimitPerCustomer') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code) return { error: 'Missing coupon code.', success: false };

  try {
    // Always sent (not just when ITEM) — switching to CART must clear any
    // previously-saved conditions, and the backend requires an explicit empty
    // array for that (an omitted field leaves existing conditions untouched).
    const conditions = targetType === 'ITEM' ? await resolveConditionsField(formData) : [];
    await apiPatch<Coupon>(`/admin/v1/coupons/${code}`, {
      description: description || null,
      discountType: discountType || undefined,
      value: value || undefined,
      currency: discountType === 'FIXED_AMOUNT' ? currencyRaw.toUpperCase() || undefined : null,
      minSubtotal: minSubtotalRaw || null,
      targetType,
      isAutoApply,
      conditions,
      usageLimit: usageLimitRaw ? Number(usageLimitRaw) : null,
      usageLimitPerCustomer: usageLimitPerCustomerRaw ? Number(usageLimitPerCustomerRaw) : null,
      startsAt: toIsoOrUndefined(formData.get('startsAt')) ?? null,
      endsAt: toIsoOrUndefined(formData.get('endsAt')) ?? null,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    if (err instanceof Error) return { error: err.message, success: false };
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
