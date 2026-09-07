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

export interface BulkDeleteResult {
  deletedCount: number;
  errors: string[];
}

/** Same shape as orders' own bulkDeleteOrders: deletes what's eligible and
 *  reports the rest rather than aborting the whole batch on the first
 *  failure (Promise.allSettled, not Promise.all). Unlike order deletion,
 *  DeleteCustomer has no status gate — it's a soft-delete (deactivate),
 *  never blocked — so in practice every selected customer succeeds; the
 *  per-item error handling still matters for a customer that's already
 *  deleted or a genuine transient failure. */
export async function bulkDeleteCustomers(publicIds: string[]): Promise<BulkDeleteResult> {
  const results = await Promise.allSettled(publicIds.map((id) => apiDelete(`/admin/v1/customers/${id}`)));
  const errors: string[] = [];
  let deletedCount = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      deletedCount++;
    } else {
      const message = r.reason instanceof ApiError ? r.reason.message : 'Unknown error';
      errors.push(`Customer ${publicIds[i]}: ${message}`);
    }
  });

  revalidatePath('/customers');
  return { deletedCount, errors };
}
