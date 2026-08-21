'use server';

import { revalidatePath } from 'next/cache';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { Warehouse, WarehouseType, ProductDetail, BulkJobStatus } from '@/lib/types';
import { resolveProductBySkuCascade } from '@/lib/resolve-product-by-sku';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export interface AdjustableVariant {
  publicId: string;
  sku: string;
  label: string;
}

export interface FindProductState {
  error: string | null;
  product: {
    publicId: string;
    sku: string;
    name: string | null;
    variants: AdjustableVariant[];
    /** Auto-selected when unambiguous — a simple product's one implicit
     *  variant, or when the typed SKU exactly matched one specific variant. */
    preselectedVariantId: string | null;
  } | null;
}

export async function findProductForAdjustment(_prevState: FindProductState, formData: FormData): Promise<FindProductState> {
  const sku = String(formData.get('sku') ?? '').trim();
  if (!sku) {
    return { error: 'Enter a SKU.', product: null };
  }

  let detail: ProductDetail | null;
  try {
    detail = await resolveProductBySkuCascade(sku);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, product: null };
    throw err;
  }
  if (!detail) {
    return { error: `No product found matching SKU "${sku}".`, product: null };
  }

  const variants: AdjustableVariant[] = detail.variants.map((v) => ({
    publicId: v.publicId,
    sku: v.sku,
    label: v.axisValues.length
      ? `${v.sku} — ${v.axisValues.map((a) => `${a.attributeLabel}: ${a.optionLabel}`).join(', ')}`
      : v.sku,
  }));
  const exactVariant = variants.find((v) => v.sku.toLowerCase() === sku.toLowerCase());

  return {
    error: null,
    product: {
      publicId: detail.publicId,
      sku: detail.sku,
      name: detail.name,
      variants,
      preselectedVariantId: exactVariant?.publicId ?? (variants.length === 1 ? variants[0].publicId : null),
    },
  };
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

export interface BulkStockRowInput {
  sku: string;
  quantity: number;
}

export interface BulkSubmitState {
  error: string | null;
  jobId: string | null;
}

/**
 * Submits a parsed CSV (already parsed client-side into rows — see
 * bulk-update-form.tsx) as one bulk-set-stock job. Called imperatively from
 * a plain client event handler, not bound via useActionState/<form> — a
 * 'use server' function doesn't require either, and this one needs to
 * return the jobId immediately so the caller can start polling
 * getBulkStockJobStatus, which useActionState's redirect-oriented state
 * model doesn't fit.
 */
export async function submitBulkSetStock(warehouseCode: string, rows: BulkStockRowInput[]): Promise<BulkSubmitState> {
  if (!warehouseCode) {
    return { error: 'Select a warehouse.', jobId: null };
  }
  if (rows.length === 0) {
    return { error: 'The CSV has no valid SKU/quantity rows.', jobId: null };
  }

  try {
    const { jobId } = await apiPost<{ jobId: string }>('/admin/v1/inventory/bulk-set-stock', { warehouseCode, rows });
    return { error: null, jobId };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, jobId: null };
    throw err;
  }
}

/** Polled repeatedly by the client while a bulk-set-stock job is in flight. */
export async function getBulkStockJobStatus(jobId: string): Promise<BulkJobStatus> {
  const status = await apiGet<BulkJobStatus>(`/admin/v1/jobs/${jobId}`);
  if (status.status === 'completed') {
    revalidatePath('/inventory');
  }
  return status;
}
