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
const cmsBlockConfigSchema = z.object({ code: z.string().min(1) });
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
          {/* Admin-authored content only (Content > Blocks) — same trust boundary as /pages/:handle. */}
          <div dangerouslySetInnerHTML={{ __html: block.body }} />
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
        gradient: DEFAULT_SLIDE_GRADIENTS[i % DEFAULT_SLIDE_GRADIENTS.length],
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
        gradient: DEFAULT_SLIDE_GRADIENTS[i % DEFAULT_SLIDE_GRADIENTS.length],
      }));
      return <PromoBanners banners={bannerProps.length > 0 ? bannerProps : undefined} />;
    }

    case 'CATEGORY_GRID': {
      const { limit } = limitConfigSchema.parse(widget.config);
      const categories = await listCategories();
      return <FeaturedCategories categories={categories} heading={widget.title ?? undefined} limit={limit} />;
    }

    case 'BRAND_GRID': {
      const { limit } = limitConfigSchema.parse(widget.config);
      const brands = await listBrands();
      return <TopBrands brands={brands} heading={widget.title ?? undefined} limit={limit} />;
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
