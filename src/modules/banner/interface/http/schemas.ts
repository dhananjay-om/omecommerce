import { z } from 'zod';
import { BannerGroup } from '@prisma/client';

/** Normalizes a whitespace-only or blank string to undefined before the real
 *  schema sees it — own-copy per module, same convention as catalog/order/store. */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);
}

/** Fixed allowlist, not free text — same preset values as the admin form's
 *  GRADIENT_PRESETS (banners/banner-form.tsx), enforced here too so a
 *  caller that bypasses the admin UI (script, future client) can't
 *  persist an arbitrary string that Tailwind's build-time JIT scanner
 *  would never generate a utility class for, silently rendering with no
 *  backdrop. Own-copy per module, same convention as blankToUndefined. */
const BANNER_GRADIENT_PRESETS = [
  'from-blue-600 to-indigo-700',
  'from-rose-500 to-pink-600',
  'from-amber-600 to-orange-700',
  'from-emerald-600 to-teal-700',
  'from-indigo-600 to-violet-700',
  'from-rose-600 to-orange-600',
  'from-primary to-blue-700',
  'from-slate-700 to-slate-900',
] as const;
const bannerGradientSchema = blankToUndefined(z.enum(BANNER_GRADIENT_PRESETS).nullish());

export const createBannerSchema = z.object({
  group: z.nativeEnum(BannerGroup),
  title: z.string().min(1).max(255),
  subtitle: blankToUndefined(z.string().max(500).nullish()),
  imageMediaKey: blankToUndefined(z.string().max(500).nullish()),
  ctaLabel: blankToUndefined(z.string().max(100).nullish()),
  ctaHref: blankToUndefined(z.string().max(500).nullish()),
  gradient: bannerGradientSchema,
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateBannerSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  subtitle: blankToUndefined(z.string().max(500).nullish()),
  imageMediaKey: blankToUndefined(z.string().max(500).nullish()),
  ctaLabel: blankToUndefined(z.string().max(100).nullish()),
  ctaHref: blankToUndefined(z.string().max(500).nullish()),
  gradient: bannerGradientSchema,
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const requestBannerImageUploadSchema = z.object({
  group: z.nativeEnum(BannerGroup),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
});

export const bannerGroupQuerySchema = z.object({
  group: z.nativeEnum(BannerGroup),
});
