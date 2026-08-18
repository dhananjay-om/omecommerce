import { z } from 'zod';
import type { WidgetInstance } from '@/services/widget.service';
import { listBanners } from '@/services/banner.service';
import { getCmsBlockOrUndefined } from '@/services/content.service';
import { listCategories } from '@/services/category.service';
import { listBrands } from '@/services/brand.service';
import { HeroBanner } from '@/components/home/hero-banner';
import { PromoBanners } from '@/components/home/promo-banners';
import { FeaturedCategories } from '@/components/home/featured-categories';
import { TopBrands } from '@/components/home/top-brands';
import { WhyChooseUs } from '@/components/home/why-choose-us';
import { Testimonials } from '@/components/home/testimonials';

const limitConfigSchema = z.object({ limit: z.number().int().positive().optional() }).catch({});
const categoryGridConfigSchema = z
  .object({ categoryIds: z.array(z.string()).optional(), limit: z.number().int().positive().optional() })
  .catch({});
const brandGridConfigSchema = z.object({ brandIds: z.array(z.string()).optional(), limit: z.number().int().positive().optional() }).catch({});
const cmsBlockConfigSchema = z.object({ code: z.string().min(1) });

/** `ids` present + non-empty ⇒ exactly those items, re-sorted to match the
 *  admin's chosen order (an ID that no longer resolves — e.g. a since-
 *  deleted category — is silently dropped rather than erroring); otherwise
 *  the original list is returned untouched (today's default behavior). */
function curateByIds<T extends { publicId: string }>(items: T[], ids: string[] | undefined): T[] {
  if (!ids || ids.length === 0) return items;
  const byId = new Map(items.map((item) => [item.publicId, item]));
  return ids.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
}
const whyChooseUsConfigSchema = z.object({
  features: z.array(z.object({ icon: z.string(), title: z.string(), description: z.string() })),
});
const testimonialListConfigSchema = z.object({ testimonials: z.array(z.object({ name: z.string(), quote: z.string() })) });

const DEFAULT_SLIDE_GRADIENTS = ['from-primary to-blue-700', 'from-indigo-600 to-violet-700', 'from-rose-600 to-orange-600'];

/**
 * One instance = one fetch of exactly the data its `type` needs, then
 * handed to the existing, already-built presentational component for that
 * content shape (HeroBanner/PromoBanners/FeaturedCategories/TopBrands/
 * WhyChooseUs/Testimonials — none of these are rewritten here). Each of
 * those components already has its own hardcoded DEFAULT_* fallback for an
 * empty/missing prop, so a widget that exists but has no backing content
 * yet (e.g. a HERO_BANNER_SLIDER with zero active Banner rows) still
 * renders something instead of a blank gap — that fallback logic doesn't
 * need to be duplicated here.
 */
export async function WidgetRenderer({ widget }: { widget: WidgetInstance }) {
  switch (widget.type) {
    case 'CMS_BLOCK': {
      const parsed = cmsBlockConfigSchema.safeParse(widget.config);
      if (!parsed.success) return null;
      const block = await getCmsBlockOrUndefined(parsed.data.code);
      if (!block) return null;
      return (
        <section className="mx-auto max-w-7xl px-4 py-6">
          {widget.title ? <h2 className="mb-4 text-xl font-bold sm:text-2xl">{widget.title}</h2> : null}
          {/* Admin-authored content only (Content > Blocks) — same trust boundary as /pages/:handle, same hand-rolled element-selector styling (no @tailwindcss/typography plugin in this app). */}
          <div
            className={
              '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-lg [&_h3]:font-bold ' +
              '[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
              '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic ' +
              '[&_a]:text-primary [&_a]:underline [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md'
            }
            dangerouslySetInnerHTML={{ __html: block.body }}
          />
        </section>
      );
    }

    case 'HERO_BANNER_SLIDER': {
      const { limit } = limitConfigSchema.parse(widget.config);
      const banners = await listBanners('HERO');
      const active = limit ? banners.slice(0, limit) : banners;
      const slides = active.map((b, i) => ({
        eyebrow: '',
        title: b.title,
        subtitle: b.subtitle ?? '',
        ctaLabel: b.ctaLabel ?? 'Shop Now',
        ctaHref: b.ctaHref ?? '/products',
        imageUrl: b.imageUrl,
        gradient: b.gradient ?? DEFAULT_SLIDE_GRADIENTS[i % DEFAULT_SLIDE_GRADIENTS.length],
      }));
      return <HeroBanner slides={slides.length > 0 ? slides : undefined} />;
    }

    case 'PROMO_BANNER_GRID': {
      const { limit } = limitConfigSchema.parse(widget.config);
      const banners = await listBanners('PROMO');
      const active = limit ? banners.slice(0, limit) : banners;
      const bannerProps = active.map((b, i) => ({
        title: b.title,
        subtitle: b.subtitle ?? '',
        href: b.ctaHref ?? '/products',
        imageUrl: b.imageUrl,
        gradient: b.gradient ?? DEFAULT_SLIDE_GRADIENTS[i % DEFAULT_SLIDE_GRADIENTS.length],
      }));
      return <PromoBanners banners={bannerProps.length > 0 ? bannerProps : undefined} />;
    }

    case 'CATEGORY_GRID': {
      const { categoryIds, limit } = categoryGridConfigSchema.parse(widget.config);
      const allCategories = await listCategories();
      const chosen =
        categoryIds && categoryIds.length > 0
          ? curateByIds(allCategories, categoryIds)
          : allCategories.filter((c) => c.parentId === null); // default: root categories only, same as before curation existed
      const categories = limit ? chosen.slice(0, limit) : chosen;
      return <FeaturedCategories categories={categories} heading={widget.title ?? undefined} />;
    }

    case 'BRAND_GRID': {
      const { brandIds, limit } = brandGridConfigSchema.parse(widget.config);
      const allBrands = await listBrands();
      const isCurated = !!brandIds && brandIds.length > 0;
      const chosen = isCurated ? curateByIds(allBrands, brandIds) : allBrands;
      // Default (uncurated) path keeps its original cap of 10 unless overridden; an explicit pick is shown in full unless `limit` trims it further.
      const effectiveLimit = limit ?? (isCurated ? undefined : 10);
      const brands = effectiveLimit ? chosen.slice(0, effectiveLimit) : chosen;
      return <TopBrands brands={brands} heading={widget.title ?? undefined} />;
    }

    case 'WHY_CHOOSE_US_LIST': {
      const parsed = whyChooseUsConfigSchema.safeParse(widget.config);
      return <WhyChooseUs features={parsed.success && parsed.data.features.length > 0 ? parsed.data.features : undefined} />;
    }

    case 'TESTIMONIAL_LIST': {
      const parsed = testimonialListConfigSchema.safeParse(widget.config);
      return <Testimonials testimonials={parsed.success && parsed.data.testimonials.length > 0 ? parsed.data.testimonials : undefined} />;
    }

    default:
      return null;
  }
}
