'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, ApiError } from '@/lib/api-client';
import type { ProductDetail } from '@/lib/types';

export interface CreateProductFormState {
  error: string | null;
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
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath(`/products/${productPublicId}`);
  redirect(`/products/${productPublicId}`);
}
