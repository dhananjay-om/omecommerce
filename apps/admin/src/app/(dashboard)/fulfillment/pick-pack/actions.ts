'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export const initialActionState: ActionState = { error: null, success: false };

/** Records where a variant's stock physically sits at one warehouse — a
 *  blank value clears a previously-set location (see SetBinLocation's own
 *  doc comment on the backend). Edited inline, right where it's actually
 *  used (picking an order), rather than a separate warehouse-stock
 *  browsing page this pass doesn't build. */
export async function setBinLocation(sku: string, warehouseCode: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const binLocation = String(formData.get('binLocation') ?? '').trim();

  try {
    await apiPost<void>('/admin/v1/inventory/bin-location', { sku, warehouseCode, binLocation });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/fulfillment/pick-pack');
  return { error: null, success: true };
}
