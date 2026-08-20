'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';
import type { CustomerGroup } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createCustomerGroup(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const isDefault = String(formData.get('isDefault') ?? 'false') === 'true';

  if (!code || !name) return { error: 'Code and name are required.', success: false };

  try {
    await apiPost<CustomerGroup>('/admin/v1/customer-groups', { code, name, isDefault });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/customer-groups');
  return { error: null, success: true };
}
