'use server';

import { apiPost, apiPut, ApiError } from '@/lib/api-client';
import type { ProductImageAnalysis, ProductPriceSuggestion, ProductCategorySuggestion } from '@/lib/types';

export interface ProductAiContext {
  title: string;
  description?: string;
  sku?: string;
  productType?: string;
  categoryNames?: string[];
  tags?: string[];
}

export interface ProductAiResult<T> {
  error: string | null;
  data?: T;
}

async function callProductAssistant<T>(path: string, body: unknown): Promise<ProductAiResult<T>> {
  try {
    const data = await apiPost<T>(path, body);
    return { error: null, data };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}

export async function generateTitle(productPublicId: string, context: ProductAiContext): Promise<ProductAiResult<{ title: string }>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/generate-title`, { context });
}

export async function generateTags(productPublicId: string, context: ProductAiContext): Promise<ProductAiResult<{ tags: string[] }>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/generate-tags`, { context });
}

export async function generateDescription(productPublicId: string, context: ProductAiContext): Promise<ProductAiResult<{ description: string }>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/generate-description`, { context });
}

export async function generateShortDescription(productPublicId: string, context: ProductAiContext): Promise<ProductAiResult<{ shortDescription: string }>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/generate-short-description`, { context });
}

export async function generateSeoTitle(productPublicId: string, context: ProductAiContext): Promise<ProductAiResult<{ metaTitle: string }>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/generate-seo-title`, { context });
}

export async function generateMetaDescription(productPublicId: string, context: ProductAiContext): Promise<ProductAiResult<{ metaDescription: string }>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/generate-meta-description`, { context });
}

export async function analyzeProductImage(
  productPublicId: string,
  storageKey: string,
  mimeType: string,
  context: ProductAiContext,
): Promise<ProductAiResult<ProductImageAnalysis>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/analyze-image`, { storageKey, mimeType, context });
}

export async function analyzePerformance(productPublicId: string, context: ProductAiContext): Promise<ProductAiResult<{ narrative: string }>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/analyze-performance`, { context });
}

export async function suggestPrice(productPublicId: string, context: ProductAiContext): Promise<ProductAiResult<ProductPriceSuggestion>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/suggest-price`, { context });
}

export async function suggestCategory(
  productPublicId: string,
  context: ProductAiContext,
  categoryNames: string[],
): Promise<ProductAiResult<ProductCategorySuggestion>> {
  return callProductAssistant(`/admin/v1/ai/products/${productPublicId}/suggest-category`, { context, categoryNames });
}

/** Writes AI-drafted SEO copy directly, unlike title/description/tags (which
 *  the AI card just fills into this page's own form fields for the admin
 *  to review, then persist via the normal "Save Changes"). Meta title/
 *  description live on a separate route (the SEO tab) this component isn't
 *  mounted on, so there's no local field to preview into — this persists
 *  immediately via the same bulk-attributes endpoint the SEO tab's own save
 *  action uses (see products/actions.ts's updateProductAttributes), and the
 *  caller is responsible for telling the admin it saved (there's no
 *  in-place preview here to make that obvious on its own). */
export async function applySeoCopy(
  productPublicId: string,
  values: { metaTitle?: string; metaDescription?: string },
): Promise<ProductAiResult<void>> {
  const items = [
    values.metaTitle !== undefined ? { attributeCode: 'meta_title', value: values.metaTitle } : null,
    values.metaDescription !== undefined ? { attributeCode: 'meta_description', value: values.metaDescription } : null,
  ].filter((v): v is { attributeCode: string; value: string } => v !== null);
  if (items.length === 0) return { error: null };

  try {
    await apiPut(`/admin/v1/products/${productPublicId}/attributes/bulk`, { values: items });
    return { error: null };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}
