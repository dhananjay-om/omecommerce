'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';
import type { OrderDetail, OrderNote } from '@/lib/types';

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

  try {
    await apiPost<OrderDetail>(`/admin/v1/orders/${orderPublicId}/fulfillments`, { lines });
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

export async function cancelOrder(orderPublicId: string, _prevState: ActionState): Promise<ActionState> {
  try {
    await apiPost<OrderDetail>(`/admin/v1/orders/${orderPublicId}/cancel`);
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
