'use server';

import { apiPost, ApiError } from '@/lib/api-client';

export interface SyncPermissionsActionState {
  error: string | null;
  result: { permissionsRegistered: number; grantsAdded: number; ranAt: string } | null;
}

export async function syncPermissions(_prevState: SyncPermissionsActionState): Promise<SyncPermissionsActionState> {
  try {
    const data = await apiPost<{ permissionsRegistered: number; grantsAdded: number }>('/admin/v1/auth/sync-permissions');
    return { error: null, result: { ...data, ranAt: new Date().toISOString() } };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, result: null };
    throw err;
  }
}
