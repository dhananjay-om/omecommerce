'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { CmsBlock } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createBlock(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!code) return { error: 'Code is required.', success: false };
  if (!body) return { error: 'Body is required.', success: false };

  let publicId: string;
  try {
    const block = await apiPost<CmsBlock>('/admin/v1/cms/blocks', { code, body });
    publicId = block.publicId;
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/blocks');
  redirect(`/content/blocks/${publicId}/edit`);
}

export async function updateBlock(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();

  if (!body) return { error: 'Body is required.', success: false };

  try {
    await apiPut<CmsBlock>(`/admin/v1/cms/blocks/${publicId}`, { body, status: status || undefined });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/blocks');
  revalidatePath(`/content/blocks/${publicId}/edit`);
  return { error: null, success: true };
}

export async function deleteBlock(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  if (!publicId) return { error: 'Missing block id.', success: false };

  try {
    await apiDelete(`/admin/v1/cms/blocks/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/blocks');
  return { error: null, success: true };
}
