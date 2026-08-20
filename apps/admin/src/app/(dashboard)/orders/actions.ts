'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';
import type { OrderDetail, OrderNote, OrderEmailLogEntry } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

function parseLines(formData: FormData): Array<{ sku: string; qty: number }> {
  const skus = formData.getAll('sku') as string[];
  const qtys = formData.getAll('qty') as string[];
  const lines: Array<{ sku: string; qty: number }> = [];
  skus.forEach((sku, i) => {
    const qty = Number(qtys[i]);
    if (sku && Number.isInteger(qty) && qty > 0) {
      lines.push({ sku, qty });
    }
  });
  return lines;
}

export async function fulfillOrder(orderPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const lines = parseLines(formData);
  if (lines.length === 0) {
    return { error: 'Enter a quantity to fulfill for at least one line.', success: false };
  }

  const trackingNumber = formData.get('trackingNumber');
  const carrier = formData.get('carrier');
  const carrierTrackingUrl = formData.get('carrierTrackingUrl');
  const estimatedDeliveryAt = formData.get('estimatedDeliveryAt');
  const shippingNotes = formData.get('shippingNotes');

  try {
    await apiPost<OrderDetail>(`/admin/v1/orders/${orderPublicId}/fulfillments`, {
      lines,
      trackingNumber: typeof trackingNumber === 'string' && trackingNumber ? trackingNumber : undefined,
      carrier: typeof carrier === 'string' && carrier ? carrier : undefined,
      carrierTrackingUrl: typeof carrierTrackingUrl === 'string' && carrierTrackingUrl ? carrierTrackingUrl : undefined,
      estimatedDeliveryAt: typeof estimatedDeliveryAt === 'string' && estimatedDeliveryAt ? estimatedDeliveryAt : undefined,
      shippingNotes: typeof shippingNotes === 'string' && shippingNotes ? shippingNotes : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}

export async function refundOrder(orderPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const lines = parseLines(formData);
  const restock = formData.get('restock') === 'on';
  if (lines.length === 0) {
    return { error: 'Enter a quantity to refund for at least one line.', success: false };
  }

  try {
    await apiPost<OrderDetail>(`/admin/v1/orders/${orderPublicId}/refunds`, { lines, restock });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}

export async function cancelOrder(orderPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const reason = formData.get('reason');
  const refundTo = formData.get('refundTo');

  try {
    await apiPost<OrderDetail>(`/admin/v1/orders/${orderPublicId}/cancel`, {
      reason: typeof reason === 'string' && reason ? reason : undefined,
      refundTo: refundTo === 'WALLET' ? 'WALLET' : 'ORIGINAL_PAYMENT_METHOD',
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}

export async function closeOrder(orderPublicId: string, _prevState: ActionState): Promise<ActionState> {
  try {
    await apiPost<OrderDetail>(`/admin/v1/orders/${orderPublicId}/close`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}

export async function markOrderPaid(orderPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const amount = String(formData.get('amount') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();

  if (!amount) {
    return { error: 'Amount collected is required.', success: false };
  }

  try {
    await apiPost(`/admin/v1/orders/${orderPublicId}/actions/mark-paid`, { amount, note: note || undefined });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}

export async function createInvoice(orderPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const lines = parseLines(formData);

  try {
    // The dialog always submits explicit per-line quantities (defaulting to
    // each line's full remaining qty), equivalent to the backend's own
    // omitted-`lines` default but lets the admin edit any quantity down for
    // partial invoicing.
    await apiPost<OrderDetail>(`/admin/v1/orders/${orderPublicId}/invoice`, { lines });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}

export async function regenerateInvoice(orderPublicId: string, invoicePublicId: string, _prevState: ActionState): Promise<ActionState> {
  try {
    await apiPost<OrderDetail>(`/admin/v1/orders/${orderPublicId}/invoice/${invoicePublicId}/regenerate`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}

export async function sendOrderEmail(orderPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const type = formData.get('type');
  const subject = formData.get('subject');
  const body = formData.get('body');
  if (typeof type !== 'string') return { error: 'Select an email type.', success: false };

  try {
    await apiPost<OrderEmailLogEntry>(`/admin/v1/orders/${orderPublicId}/send-email`, {
      type,
      subject: typeof subject === 'string' && subject ? subject : undefined,
      body: typeof body === 'string' && body ? body : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}

export async function addOrderNote(orderPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const type = formData.get('type');
  const body = formData.get('body');
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { error: 'Note body is required.', success: false };
  }

  try {
    await apiPost<OrderNote>(`/admin/v1/orders/${orderPublicId}/notes`, { type: type === 'CUSTOMER' ? 'CUSTOMER' : 'INTERNAL', body });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/orders/${orderPublicId}`);
  return { error: null, success: true };
}
