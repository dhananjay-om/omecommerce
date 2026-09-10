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

// Plain px integers — generous but sane bounds (a panel wider than a very
// large monitor, or a promo image taller than that, is always a mistake,
// not a real intent) so a stray huge number can't break the dropdown's
// layout for every visitor.
const pxDimension = (max: number) => blankToUndefined(z.coerce.number().int().min(1).max(max).nullish());
const megaMenuPositionSchema = z.enum(['left', 'right', 'top', 'bottom']);

export const createMegaMenuItemSchema = z.object({
  label: z.string().trim().min(1).max(100),
  href: z.string().trim().min(1).max(500),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
  columns: z.array(megaMenuColumnSchema).max(6).optional(),
  promoImageMediaKey: blankToUndefined(z.string().max(500).nullish()),
  promoHref: blankToUndefined(z.string().max(500).nullish()),
  promoCaption: blankToUndefined(z.string().max(200).nullish()),
  panelWidth: pxDimension(2000),
  columnGap: pxDimension(200),
  promoImageWidth: pxDimension(2000),
  promoImageHeight: pxDimension(2000),
  promoImagePosition: megaMenuPositionSchema.optional(),
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
  panelWidth: pxDimension(2000),
  columnGap: pxDimension(200),
  promoImageWidth: pxDimension(2000),
  promoImageHeight: pxDimension(2000),
  promoImagePosition: megaMenuPositionSchema.optional(),
});

export const requestMegaMenuImageUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
});
