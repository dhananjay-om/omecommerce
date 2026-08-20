'use server';

import { revalidatePath } from 'next/cache';
import { apiDelete, ApiError } from '@/lib/api-client';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function deleteCustomer(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  if (!publicId) {
    return { error: 'Missing customer id.', success: false };
  }

  try {
    await apiDelete(`/admin/v1/customers/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/customers');
  revalidatePath(`/customers/${publicId}`);
  return { error: null, success: true };
}
