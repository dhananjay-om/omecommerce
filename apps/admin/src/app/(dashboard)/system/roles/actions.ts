'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { Role } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createRole(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();

  if (!code || !name) {
    return { error: 'Code and name are required.', success: false };
  }

  try {
    await apiPost<{ code: string }>('/admin/v1/auth/roles', { code, name });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/roles');
  return { error: null, success: true };
}

export async function updateRolePermissions(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '');
  const permissionCodes = formData.getAll('permissionCodes').map(String);
  if (!code) return { error: 'Missing role.', success: false };

  try {
    await apiPut<Role>(`/admin/v1/auth/roles/${code}/permissions`, { permissionCodes });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/roles');
  revalidatePath(`/system/roles/${code}/edit`);
  return { error: null, success: true };
}

export async function deleteRole(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '');
  if (!code) return { error: 'Missing role.', success: false };

  try {
    await apiDelete(`/admin/v1/auth/roles/${code}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/system/roles');
  return { error: null, success: true };
}
