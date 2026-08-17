'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { WidgetInstance } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createWidget(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const type = String(formData.get('type') ?? '').trim();
  const section = String(formData.get('section') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  const configJson = String(formData.get('configJson') ?? '{}');

  if (!type) return { error: 'Type is required.', success: false };
  if (!section) return { error: 'Section is required.', success: false };

  let config: unknown;
  try {
    config = JSON.parse(configJson);
  } catch {
    return { error: 'Invalid widget configuration.', success: false };
  }

  let publicId: string;
  try {
    const widget = await apiPost<WidgetInstance>('/admin/v1/widgets', {
      type,
      section,
      title: title || undefined,
      position: position ? Number(position) : undefined,
      config,
    });
    publicId = widget.publicId;
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/widgets');
  redirect(`/content/widgets/${publicId}/edit`);
}

export async function updateWidget(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  const section = String(formData.get('section') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? '').trim();
  const configJson = String(formData.get('configJson') ?? '{}');

  let config: unknown;
  try {
    config = JSON.parse(configJson);
  } catch {
    return { error: 'Invalid widget configuration.', success: false };
  }

  try {
    await apiPut<WidgetInstance>(`/admin/v1/widgets/${publicId}`, {
      section: section || undefined,
      title: title || null,
      position: position ? Number(position) : undefined,
      isActive: isActive ? isActive === 'true' : undefined,
      config,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/widgets');
  revalidatePath(`/content/widgets/${publicId}/edit`);
  return { error: null, success: true };
}

export async function deleteWidget(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  if (!publicId) return { error: 'Missing widget id.', success: false };

  try {
    await apiDelete(`/admin/v1/widgets/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/widgets');
  return { error: null, success: true };
}
