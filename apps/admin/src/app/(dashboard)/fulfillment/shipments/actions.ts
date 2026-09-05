'use server';

import { revalidatePath } from 'next/cache';
import { apiPatch, ApiError } from '@/lib/api-client';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/** Fixes/adds tracking info after the fact — FulfillOrder itself only
 *  ever sets tracking once, at creation time (see UpdateShipmentTracking's
 *  own doc comment on the backend). Blank fields are omitted from the
 *  request entirely (never sent as an empty string), same "leave
 *  unchanged" contract as every other edit-in-place form this app uses —
 *  this dialog can add/correct a value, not clear one back out. */
export async function updateShipmentTracking(fulfillmentPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const carrier = formData.get('carrier');
  const trackingNumber = formData.get('trackingNumber');
  const carrierTrackingUrl = formData.get('carrierTrackingUrl');
  const estimatedDeliveryAt = formData.get('estimatedDeliveryAt');
  const shippingNotes = formData.get('shippingNotes');

  try {
    await apiPatch<void>(`/admin/v1/fulfillments/${fulfillmentPublicId}`, {
      carrier: typeof carrier === 'string' && carrier ? carrier : undefined,
      trackingNumber: typeof trackingNumber === 'string' && trackingNumber ? trackingNumber : undefined,
      carrierTrackingUrl: typeof carrierTrackingUrl === 'string' && carrierTrackingUrl ? carrierTrackingUrl : undefined,
      estimatedDeliveryAt: typeof estimatedDeliveryAt === 'string' && estimatedDeliveryAt ? estimatedDeliveryAt : undefined,
      shippingNotes: typeof shippingNotes === 'string' && shippingNotes ? shippingNotes : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/fulfillment/shipments');
  return { error: null, success: true };
}
