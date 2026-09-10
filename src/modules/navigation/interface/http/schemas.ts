import { z } from 'zod';

/** Normalizes a whitespace-only or blank string to undefined before the
 *  real schema sees it — own-copy per module, same convention as
 *  catalog/order/store/banner. */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);
}

const megaMenuLinkSchema = z.object({
  label: z.string().trim().min(1).max(100),
  href: z.string().trim().min(1).max(500),
});

const megaMenuColumnSchema = z.object({
  heading: z.string().trim().min(1).max(100),
  links: z.array(megaMenuLinkSchema).max(20),
});

export const createMegaMenuItemSchema = z.object({
  label: z.string().trim().min(1).max(100),
  href: z.string().trim().min(1).max(500),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
  columns: z.array(megaMenuColumnSchema).max(6).optional(),
  promoImageMediaKey: blankToUndefined(z.string().max(500).nullish()),
  promoHref: blankToUndefined(z.string().max(500).nullish()),
  promoCaption: blankToUndefined(z.string().max(200).nullish()),
});

export const updateMegaMenuItemSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  href: z.string().trim().min(1).max(500).optional(),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
  columns: z.array(megaMenuColumnSchema).max(6).optional(),
  promoImageMediaKey: blankToUndefined(z.string().max(500).nullish()),
  promoHref: blankToUndefined(z.string().max(500).nullish()),
  promoCaption: blankToUndefined(z.string().max(200).nullish()),
});

export const requestMegaMenuImageUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
});
