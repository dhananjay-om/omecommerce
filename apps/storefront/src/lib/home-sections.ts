import { z } from 'zod';

/** JSON shapes stored in the well-known-code CmsBlock rows the admin's
 *  Content > Home Page screen manages (home_hero_banner, home_promo_banners,
 *  home_why_choose_us, home_testimonials — see that screen's section-fields.ts
 *  for the admin-side field list these mirror). A missing block, an
 *  unpublished block, or a body that fails this shape check all fall back to
 *  the hardcoded defaults in each component — this file's schemas are the
 *  only thing standing between a hand-edited/corrupted CmsBlock body and a
 *  broken homepage, so parse failures must be silent + recoverable, never thrown. */

const heroSlideSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
  gradient: z.string(),
});
export const heroBannerSectionSchema = z.object({ slides: z.array(heroSlideSchema).min(1) });
export type HeroSlideData = z.infer<typeof heroSlideSchema>;

const promoBannerSchema = z.object({ title: z.string(), subtitle: z.string(), href: z.string(), gradient: z.string() });
export const promoBannersSectionSchema = z.object({ banners: z.array(promoBannerSchema).min(1) });
export type PromoBannerData = z.infer<typeof promoBannerSchema>;

/** `icon` is validated loosely here (just "a string") — the fixed allowlist
 *  matching the admin's ICON_OPTIONS is enforced at render time in
 *  why-choose-us.tsx, which falls back to the truck icon for anything it
 *  doesn't recognize rather than rejecting the whole section over one bad key. */
const whyChooseUsFeatureSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
});
export const whyChooseUsSectionSchema = z.object({ features: z.array(whyChooseUsFeatureSchema).min(1) });
export type WhyChooseUsFeatureData = z.infer<typeof whyChooseUsFeatureSchema>;

const testimonialSchema = z.object({ name: z.string(), quote: z.string() });
export const testimonialsSectionSchema = z.object({ testimonials: z.array(testimonialSchema).min(1) });
export type TestimonialData = z.infer<typeof testimonialSchema>;

/** Parses a CmsBlock's raw `body` string against a section schema, returning
 *  null on ANY failure (malformed JSON, wrong shape, empty array) so the
 *  caller can fall back to hardcoded defaults instead of throwing/crashing
 *  the home page render. */
export function parseHomeSection<T>(body: string | undefined, schema: z.ZodType<T>): T | null {
  if (!body) return null;
  try {
    const result = schema.safeParse(JSON.parse(body));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
