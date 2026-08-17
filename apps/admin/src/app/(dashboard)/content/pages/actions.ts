'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { CmsPage } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createPage(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const handle = String(formData.get('handle') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!handle) return { error: 'Handle is required.', success: false };
  if (!title) return { error: 'Title is required.', success: false };
  if (!body) return { error: 'Body is required.', success: false };

  let publicId: string;
  try {
    const page = await apiPost<CmsPage>('/admin/v1/cms/pages', { handle, title, body });
    publicId = page.publicId;
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/pages');
  redirect(`/content/pages/${publicId}/edit`);
}

export async function updatePage(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();

  if (!title) return { error: 'Title is required.', success: false };
  if (!body) return { error: 'Body is required.', success: false };

  try {
    await apiPut<CmsPage>(`/admin/v1/cms/pages/${publicId}`, { title, body, status: status || undefined });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/pages');
  revalidatePath(`/content/pages/${publicId}/edit`);
  return { error: null, success: true };
}

export async function deletePage(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  if (!publicId) return { error: 'Missing page id.', success: false };

  try {
    await apiDelete(`/admin/v1/cms/pages/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/pages');
  return { error: null, success: true };
}
