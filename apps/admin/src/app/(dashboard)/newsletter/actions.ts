'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { NewsletterSubscriber } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function addSubscriber(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Email is required.', success: false };
  try {
    await apiPost<NewsletterSubscriber>('/admin/v1/newsletter/subscribers', { email });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }
  revalidatePath('/newsletter');
  return { error: null, success: true };
}

/** Called imperatively from the row buttons (no form), so returns a plain
 *  error string rather than ActionState. */
export async function setSubscriberStatus(publicId: string, status: 'SUBSCRIBED' | 'UNSUBSCRIBED'): Promise<string | null> {
  try {
    await apiPatch(`/admin/v1/newsletter/subscribers/${publicId}`, { status });
  } catch (err) {
    if (err instanceof ApiError) return err.message;
    throw err;
  }
  revalidatePath('/newsletter');
  return null;
}

export async function deleteSubscriber(publicId: string): Promise<string | null> {
  try {
    await apiDelete(`/admin/v1/newsletter/subscribers/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return err.message;
    throw err;
  }
  revalidatePath('/newsletter');
  return null;
}
