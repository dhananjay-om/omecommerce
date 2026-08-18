'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';
import type { IssuedGiftCard, GiftCard } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/** Deliberate deviation from this app's usual create-action-redirects
 *  convention (see coupon-form.tsx's own documented deviation for the
 *  precedent this follows): issuing a gift card returns the raw redeemable
 *  code exactly once — only its hash is ever stored server-side, so it can
 *  never be shown again after this response. Redirecting immediately to the
 *  detail page (like every other create-action does) would throw the code
 *  away before the admin could copy it. `issued` carries it back to the
 *  form so it can render a "copy this now" panel instead. */
export interface IssueGiftCardState extends ActionState {
  issued: { publicId: string; code: string; codeLast4: string } | null;
}

export async function issueGiftCard(_prevState: IssueGiftCardState, formData: FormData): Promise<IssueGiftCardState> {
  const websiteCode = String(formData.get('websiteCode') ?? '').trim();
  const amount = String(formData.get('amount') ?? '').trim();
  const kind = String(formData.get('kind') ?? '').trim();
  const recipientEmail = String(formData.get('recipientEmail') ?? '').trim();
  const recipientName = String(formData.get('recipientName') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const expiresAtDate = String(formData.get('expiresAt') ?? '').trim();

  if (!websiteCode) return { error: 'Website is required.', success: false, issued: null };
  if (!amount) return { error: 'Amount is required.', success: false, issued: null };

  try {
    const card = await apiPost<IssuedGiftCard>('/admin/v1/gift-cards', {
      websiteCode,
      amount,
      kind: kind || undefined,
      recipientEmail: recipientEmail || undefined,
      recipientName: recipientName || undefined,
      message: message || undefined,
      expiresAt: expiresAtDate ? new Date(expiresAtDate).toISOString() : undefined,
    });
    revalidatePath('/gift-cards');
    return { error: null, success: true, issued: { publicId: card.publicId, code: card.code, codeLast4: card.codeLast4 } };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false, issued: null };
    throw err;
  }
}

export async function adjustGiftCard(publicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const amount = String(formData.get('amount') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!amount) return { error: 'Amount is required.', success: false };
  if (!reason) return { error: 'Reason is required.', success: false };

  try {
    await apiPost<GiftCard>(`/admin/v1/gift-cards/${publicId}/actions/adjust`, { amount, reason });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/gift-cards/${publicId}`);
  return { error: null, success: true };
}

export async function disableGiftCard(publicId: string, _prevState: ActionState): Promise<ActionState> {
  try {
    await apiPost<void>(`/admin/v1/gift-cards/${publicId}/actions/disable`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/gift-cards/${publicId}`);
  revalidatePath('/gift-cards');
  return { error: null, success: true };
}
