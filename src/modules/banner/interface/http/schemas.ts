import { z } from 'zod';
import { BannerGroup } from '@prisma/client';

/** Normalizes a whitespace-only or blank string to undefined before the real
 *  schema sees it — own-copy per module, same convention as catalog/order/store. */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);
}

export const createBannerSchema = z.object({
  group: z.nativeEnum(BannerGroup),
  title: z.string().min(1).max(255),
  subtitle: blankToUndefined(z.string().max(500).nullish()),
  imageMediaKey: blankToUndefined(z.string().max(500).nullish()),
  ctaLabel: blankToUndefined(z.string().max(100).nullish()),
  ctaHref: blankToUndefined(z.string().max(500).nullish()),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateBannerSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  subtitle: blankToUndefined(z.string().max(500).nullish()),
  imageMediaKey: blankToUndefined(z.string().max(500).nullish()),
  ctaLabel: blankToUndefined(z.string().max(100).nullish()),
  ctaHref: blankToUndefined(z.string().max(500).nullish()),
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
