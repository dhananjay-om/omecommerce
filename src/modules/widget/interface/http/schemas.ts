import { z } from 'zod';
import { WidgetSection } from '@prisma/client';

/** Normalizes a whitespace-only or blank string to undefined before the real
 *  schema sees it — own-copy per module, same convention as catalog/order/store/banner. */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);
}

const cmsBlockConfigSchema = z.object({ code: z.string().min(1).max(255) });
const limitConfigSchema = z.object({ limit: z.number().int().positive().max(100).optional() });
/** `categoryIds`/`brandIds` present + non-empty ⇒ exactly those, in that
 *  order (an admin-controlled curation, not raw table order); empty/unset
 *  ⇒ today's fallback (all root categories/brands, optionally capped by
 *  `limit`) — see widget-renderer.tsx on the storefront side. */
const categoryGridConfigSchema = z.object({
  categoryIds: z.array(z.string().uuid()).max(24).optional(),
  limit: z.number().int().positive().max(100).optional(),
});
const brandGridConfigSchema = z.object({
  brandIds: z.array(z.string().uuid()).max(24).optional(),
  limit: z.number().int().positive().max(100).optional(),
});
const featureSchema = z.object({ icon: z.string().min(1), title: z.string().min(1), description: z.string().min(1) });
const whyChooseUsConfigSchema = z.object({ features: z.array(featureSchema).min(1).max(12) });
const testimonialSchema = z.object({ name: z.string().min(1), quote: z.string().min(1) });
const testimonialListConfigSchema = z.object({ testimonials: z.array(testimonialSchema).min(1).max(12) });

const baseFields = {
  page: z.string().min(1).max(64).optional(),
  section: z.nativeEnum(WidgetSection),
  position: z.number().int().optional(),
  title: blankToUndefined(z.string().max(255).nullish()),
  isActive: z.boolean().optional(),
  /** Shared across every widget type (unlike `config`, which is per-type) —
   *  raw CSS injected as-is on the storefront, see widget.prisma's header comment. */
  customCss: blankToUndefined(z.string().max(20000).nullish()),
};

/** Discriminated on `type` so each widget type's `config` is validated
 *  against its own real shape, not an unstructured record — a garbage
 *  config for a given type is rejected at creation, not just at render
 *  time on the storefront. */
export const createWidgetInstanceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CMS_BLOCK'), config: cmsBlockConfigSchema, ...baseFields }),
  z.object({ type: z.literal('HERO_BANNER_SLIDER'), config: limitConfigSchema, ...baseFields }),
  z.object({ type: z.literal('PROMO_BANNER_GRID'), config: limitConfigSchema, ...baseFields }),
  z.object({ type: z.literal('CATEGORY_GRID'), config: categoryGridConfigSchema, ...baseFields }),
  z.object({ type: z.literal('BRAND_GRID'), config: brandGridConfigSchema, ...baseFields }),
  z.object({ type: z.literal('WHY_CHOOSE_US_LIST'), config: whyChooseUsConfigSchema, ...baseFields }),
  z.object({ type: z.literal('TESTIMONIAL_LIST'), config: testimonialListConfigSchema, ...baseFields }),
]);

/** `type` is immutable after creation (same convention as Category's slug/
 *  CmsPage's handle) — not part of the update body, so `config` can't be
 *  discriminated against it here. The admin form only ever submits config
 *  matching the widget's own existing type, same trust level as CmsBlock's
 *  update schema not deeply validating its HTML body. */
export const updateWidgetInstanceSchema = z.object({
  section: z.nativeEnum(WidgetSection).optional(),
  position: z.number().int().optional(),
  title: blankToUndefined(z.string().max(255).nullish()),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  customCss: blankToUndefined(z.string().max(20000).nullish()),
});

export const widgetPageQuerySchema = z.object({
  page: z.string().min(1).max(64),
});

export const widgetSectionQuerySchema = z.object({
  page: z.string().min(1).max(64),
  section: z.nativeEnum(WidgetSection),
});
