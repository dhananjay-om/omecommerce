'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { AlertRuleView } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/** "a@b.com, c@d.com\ne@f.com" -> ["a@b.com", "c@d.com", "e@f.com"] — the
 *  textarea accepts either separator so pasting a comma list or one address
 *  per line both work. */
function parseRecipientEmails(raw: string): string[] {
  return raw
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createAlertRule(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const metricCode = String(formData.get('metricCode') ?? '').trim();
  const comparator = String(formData.get('comparator') ?? '').trim();
  const thresholdValue = String(formData.get('thresholdValue') ?? '').trim();
  const windowDaysRaw = String(formData.get('windowDays') ?? '').trim();
  const recipientEmails = parseRecipientEmails(String(formData.get('recipientEmails') ?? ''));
  const isActive = formData.get('isActive') === 'on';

  if (!metricCode) return { error: 'Metric is required.', success: false };
  if (!comparator) return { error: 'Comparator is required.', success: false };
  if (!thresholdValue) return { error: 'Threshold is required.', success: false };
  if (recipientEmails.length === 0) return { error: 'At least one recipient email is required.', success: false };

  try {
    await apiPost<AlertRuleView>('/admin/v1/analytics/alert-rules', {
      metricCode,
      comparator,
      thresholdValue,
      windowDays: windowDaysRaw ? Number(windowDaysRaw) : 1,
      recipientEmails,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/reports/alerts');
  return { error: null, success: true };
}

export async function updateAlertRule(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  const comparator = String(formData.get('comparator') ?? '').trim();
  const thresholdValue = String(formData.get('thresholdValue') ?? '').trim();
  const windowDaysRaw = String(formData.get('windowDays') ?? '').trim();
  const recipientEmails = parseRecipientEmails(String(formData.get('recipientEmails') ?? ''));
  const isActive = formData.get('isActive') === 'on';

  if (!publicId) return { error: 'Missing alert rule id.', success: false };
  if (!thresholdValue) return { error: 'Threshold is required.', success: false };
  if (recipientEmails.length === 0) return { error: 'At least one recipient email is required.', success: false };

  try {
    await apiPut<AlertRuleView>(`/admin/v1/analytics/alert-rules/${publicId}`, {
      comparator: comparator || undefined,
      thresholdValue,
      windowDays: windowDaysRaw ? Number(windowDaysRaw) : 1,
      recipientEmails,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/reports/alerts');
  return { error: null, success: true };
}

export async function deleteAlertRule(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  if (!publicId) return { error: 'Missing alert rule id.', success: false };

  try {
    await apiDelete(`/admin/v1/analytics/alert-rules/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/reports/alerts');
  return { error: null, success: true };
}
