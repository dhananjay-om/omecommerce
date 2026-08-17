'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPut, apiGet, ApiError } from '@/lib/api-client';
import type { CmsBlock } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/**
 * Each Home Page section is backed by an ordinary, well-known-code CmsBlock
 * (storeViewId: null / GLOBAL — see the Content Management plan's confirmed
 * v1 scope) rather than a dedicated table — reuses the CmsBlock CRUD that
 * already exists instead of adding four new tables for four repeatable-row
 * shapes. Create-if-missing, then always PUBLISH (homepage edits go live
 * immediately, same as every other admin "Save" in this app — no
 * draft-staging UI here even though the block itself supports it). A
 * power-user admin can still find these same rows under Content > Blocks
 * and hand-edit the JSON or flip Draft/Published there.
 */
async function upsertHomeSectionBlock(code: string, body: string): Promise<{ error: string | null }> {
  try {
    const blocks = await apiGet<CmsBlock[]>('/admin/v1/cms/blocks');
    const existing = blocks.find((b) => b.code === code);

    if (existing) {
      await apiPut<CmsBlock>(`/admin/v1/cms/blocks/${existing.publicId}`, { body, status: 'PUBLISHED' });
    } else {
      const created = await apiPost<CmsBlock>('/admin/v1/cms/blocks', { code, body });
      await apiPut<CmsBlock>(`/admin/v1/cms/blocks/${created.publicId}`, { status: 'PUBLISHED' });
    }
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  revalidatePath('/content/home-page');
  revalidatePath('/content/blocks');
  return { error: null };
}

export async function saveHeroBanner(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const slides = String(formData.get('slidesJson') ?? '[]');
  const result = await upsertHomeSectionBlock('home_hero_banner', JSON.stringify({ slides: JSON.parse(slides) }));
  return { error: result.error, success: !result.error };
}

export async function savePromoBanners(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const banners = String(formData.get('bannersJson') ?? '[]');
  const result = await upsertHomeSectionBlock('home_promo_banners', JSON.stringify({ banners: JSON.parse(banners) }));
  return { error: result.error, success: !result.error };
}

export async function saveWhyChooseUs(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const features = String(formData.get('featuresJson') ?? '[]');
  const result = await upsertHomeSectionBlock('home_why_choose_us', JSON.stringify({ features: JSON.parse(features) }));
  return { error: result.error, success: !result.error };
}

export async function saveTestimonials(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const testimonials = String(formData.get('testimonialsJson') ?? '[]');
  const result = await upsertHomeSectionBlock('home_testimonials', JSON.stringify({ testimonials: JSON.parse(testimonials) }));
  return { error: result.error, success: !result.error };
}
