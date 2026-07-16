'use server';

import { redirect } from 'next/navigation';
import { apiPost, ApiError } from '@/lib/api-client';
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
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.message };
    }
    throw err;
  }

  redirect(`/products/${created.publicId}`);
}
