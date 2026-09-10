'use server';

import { revalidatePath } from 'next/cache';
import { apiPatch, apiPost, ApiError } from '@/lib/api-client';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function markOneRead(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '');
  if (!publicId) return { error: 'Missing notification.', success: false };

  try {
    await apiPatch(`/admin/v1/notifications/${publicId}/read`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/notifications');
  return { error: null, success: true };
}

export async function markAllRead(_prevState: ActionState): Promise<ActionState> {
  try {
    await apiPost('/admin/v1/notifications/mark-all-read');
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/notifications');
  return { error: null, success: true };
}
