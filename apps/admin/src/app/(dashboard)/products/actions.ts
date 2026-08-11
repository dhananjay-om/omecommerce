'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { ProductDetail } from '@/lib/types';

export interface CreateProductFormState {
  error: string | null;
}

/** Reads back the `attr__<code>` fields the AttributeFieldsSection rendered, using
 * the `__attrTypes` map it embeds to know how to parse each one (a plain <input>
 * can't tell you its own semantic type — MULTISELECT needs getAll(), BOOLEAN needs
 * checkbox-presence, etc). Fields left empty are omitted, not cleared — there's no
 * "unset this attribute value" endpoint in this pass. */
function parseAttributeValues(formData: FormData): Array<{ attributeCode: string; value: unknown }> {
  const rawTypes = formData.get('__attrTypes');
  if (!rawTypes) return [];
  const attrTypes = JSON.parse(String(rawTypes)) as Record<string, string>;

  const values: Array<{ attributeCode: string; value: unknown }> = [];
  for (const [code, dataType] of Object.entries(attrTypes)) {
    const name = `attr__${code}`;
    if (dataType === 'MULTISELECT') {
      const arr = formData.getAll(name).map(String);
      if (arr.length > 0) values.push({ attributeCode: code, value: arr });
    } else if (dataType === 'BOOLEAN') {
      values.push({ attributeCode: code, value: formData.get(name) === 'on' });
    } else if (dataType === 'NUMBER') {
      const raw = formData.get(name);
      if (raw !== null && String(raw).trim() !== '') values.push({ attributeCode: code, value: Number(raw) });
    } else {
      const raw = formData.get(name);
      if (raw !== null && String(raw).trim() !== '') values.push({ attributeCode: code, value: String(raw) });
    }
  }
  return values;
}

async function saveAttributeValues(productPublicId: string, formData: FormData): Promise<void> {
  const values = parseAttributeValues(formData);
  if (values.length === 0) return;
  await apiPut(`/admin/v1/products/${productPublicId}/attributes/bulk`, { values });
}

/** Always called, even with zero categories — this endpoint replaces the full assigned set, so an empty submission legitimately means "clear all categories". */
async function saveCategoryIds(productPublicId: string, formData: FormData): Promise<void> {
  const categoryIds = formData.getAll('categoryIds').map(String);
  await apiPut(`/admin/v1/products/${productPublicId}/categories`, { categoryIds });
}

export async function createProduct(_prevState: CreateProductFormState, formData: FormData): Promise<CreateProductFormState> {
  const type = String(formData.get('type') ?? '');
  const sku = String(formData.get('sku') ?? '').trim();
  const attributeSetId = String(formData.get('attributeSetId') ?? '');
  const nameDefault = String(formData.get('nameDefault') ?? '').trim();
  const status = String(formData.get('status') ?? '');
  const weight = String(formData.get('weight') ?? '').trim();

  if (!type || !sku || !attributeSetId) {
    return { error: 'Type, SKU, and attribute set are required.' };
  }

  let created: ProductDetail;
  try {
    created = await apiPost<ProductDetail>('/admin/v1/products', {
      type,
      sku,
      attributeSetId,
      status: status || undefined,
      nameDefault: nameDefault || undefined,
      weight: weight || undefined,
    });
    await saveAttributeValues(created.publicId, formData);
    await saveCategoryIds(created.publicId, formData);
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.message };
    }
    throw err;
  }

  redirect(`/products/${created.publicId}`);
}

export interface UpdateProductFormState {
  error: string | null;
}

export async function updateProduct(
  productPublicId: string,
  _prevState: UpdateProductFormState,
  formData: FormData,
): Promise<UpdateProductFormState> {
  const attributeSetId = String(formData.get('attributeSetId') ?? '');
  const nameDefault = String(formData.get('nameDefault') ?? '').trim();
  const status = String(formData.get('status') ?? '');
  const visibility = String(formData.get('visibility') ?? '');
  const weight = String(formData.get('weight') ?? '').trim();

  if (!attributeSetId) {
    return { error: 'Attribute set is required.' };
  }

  try {
    await apiPatch<ProductDetail>(`/admin/v1/products/${productPublicId}`, {
      attributeSetId,
      nameDefault: nameDefault || null,
      status: status || undefined,
      visibility: visibility || undefined,
      weight: weight || null,
    });
    await saveAttributeValues(productPublicId, formData);
    await saveCategoryIds(productPublicId, formData);
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath(`/products/${productPublicId}`);
  redirect(`/products/${productPublicId}`);
}

export interface BulkUpdateStatusResult {
  error: string | null;
}

/** Loops PATCH calls, one per selected product — fine here since status is a single
 * scalar field (unlike the attribute bulk-write in Phase H, which genuinely needed a
 * transaction to avoid N outbox events for one form save). */
export async function bulkUpdateProductStatus(publicIds: string[], status: string): Promise<BulkUpdateStatusResult> {
  try {
    await Promise.all(publicIds.map((id) => apiPatch<ProductDetail>(`/admin/v1/products/${id}`, { status })));
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath('/products');
  return { error: null };
}

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function deleteProduct(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  if (!publicId) {
    return { error: 'Missing product id.', success: false };
  }

  try {
    await apiDelete(`/admin/v1/products/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/products');
  return { error: null, success: true };
}
