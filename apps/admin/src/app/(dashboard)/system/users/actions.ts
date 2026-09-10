'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiPut, ApiError } from '@/lib/api-client';
import type { AdminUser } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createAdminUser(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const roleCodes = formData.getAll('roleCodes').map(String);

  if (!email || password.length < 8) {
    return { error: 'A valid email and a password of at least 8 characters are required.', success: false };
  }

  try {
    await apiPost<AdminUser>('/admin/v1/auth/admin-users', { email, password, roleCodes });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/users');
  return { error: null, success: true };
}

export async function setAdminUserActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '');
  const isActive = String(formData.get('isActive') ?? '') === 'true';
  if (!publicId) return { error: 'Missing admin user.', success: false };

  try {
    await apiPatch(`/admin/v1/auth/admin-users/${publicId}/active`, { isActive });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/users');
  return { error: null, success: true };
}

export async function updateAdminUserRoles(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '');
  const roleCodes = formData.getAll('roleCodes').map(String);
  if (!publicId) return { error: 'Missing admin user.', success: false };

  try {
    await apiPut(`/admin/v1/auth/admin-users/${publicId}/roles`, { roleCodes });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/users');
  return { error: null, success: true };
}

export async function resetAdminUserPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  if (!publicId) return { error: 'Missing admin user.', success: false };
  if (newPassword.length < 8) return { error: 'New password must be at least 8 characters.', success: false };

  try {
    await apiPost(`/admin/v1/auth/admin-users/${publicId}/reset-password`, { newPassword });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/users');
  return { error: null, success: true };
}
