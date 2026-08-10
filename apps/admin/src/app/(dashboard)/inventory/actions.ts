'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { Warehouse, WarehouseType } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createWarehouse(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '') as WarehouseType | '';

  if (!code || !name) {
    return { error: 'Code and name are required.', success: false };
  }

  try {
    await apiPost<Warehouse>('/admin/v1/warehouses', { code, name, type: type || undefined });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/warehouses');
  return { error: null, success: true };
}

export async function updateWarehouse(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '') as WarehouseType | '';
  const priorityRaw = String(formData.get('priority') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code || !name) {
    return { error: 'Name is required.', success: false };
  }

  try {
    await apiPatch<Warehouse>(`/admin/v1/warehouses/${code}`, {
      name,
      type: type || undefined,
      priority: priorityRaw ? Number(priorityRaw) : undefined,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/warehouses');
  return { error: null, success: true };
}

export async function deleteWarehouse(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) {
    return { error: 'Missing warehouse code.', success: false };
  }

  try {
    await apiDelete(`/admin/v1/warehouses/${code}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/warehouses');
  return { error: null, success: true };
}

export async function adjustStock(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const variantId = String(formData.get('variantId') ?? '').trim();
  const warehouseCode = String(formData.get('warehouseCode') ?? '').trim();
  const delta = Number(formData.get('delta'));
  const reason = String(formData.get('reason') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  if (!variantId || !warehouseCode || !reason || !Number.isInteger(delta) || delta === 0) {
    return { error: 'Variant, warehouse, a non-zero whole-number quantity, and a reason are required.', success: false };
  }

  try {
    await apiPost('/admin/v1/inventory/adjustments', {
      variantId,
      warehouseCode,
      delta,
      reason,
      note: note || undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/inventory');
  return { error: null, success: true };
}
