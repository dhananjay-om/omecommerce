import dynamic from 'next/dynamic';
import { searchProducts } from '@/services/products.service';
import { listWidgets } from '@/services/widget.service';
import { listCategories } from '@/services/category.service';
import { WidgetZone } from '@/components/widgets/widget-zone';
import { ProductCarousel } from '@/components/product/product-carousel';
import { InstagramGallery } from '@/components/home/instagram-gallery';
import { MarqueeStrip } from '@/components/home/marquee-strip';
import { FeaturedCategories } from '@/components/home/featured-categories';
import { PromoBanners } from '@/components/home/promo-banners';
import { PromoOfferBanner } from '@/components/home/promo-offer-banner';
import { Testimonials } from '@/components/home/testimonials';
import { Reveal } from '@/components/motion/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { mockProductPhoto } from '@/lib/mock-images';
import type { SearchHit } from '@/types/product';

// Below-the-fold and its own client bundle (form state) — deferred so it
// isn't part of the initial JS needed to render the hero/featured sections.
const NewsletterSection = dynamic(() => import('@/components/home/newsletter-section').then((m) => m.NewsletterSection), {
  loading: () => <Skeleton className="h-48 w-full" />,
});

/** Home-page-only presentation swap: the seeded demo catalog's real images
 *  are flat placeholder graphics, not real photography — this store hasn't
 *  had real product photos uploaded yet. Scoped to the homepage carousels
 *  specifically (per the storefront restyle's "home page first" request);
 *  PLP/PDP/cart still show each product's real `imageUrl` untouched, so
 *  this doesn't change what any other page displays for the same product.
 *  A product with a genuinely different (non-placeholder) real photo would
 *  need its own opt-out, not built here since every seeded product uses
 *  the same placeholder generator today. */
function withMockImages(hits: SearchHit[]): SearchHit[] {
  return hits.map((hit) => ({ ...hit, imageUrl: mockProductPhoto(hit.name) }));
}

/**
 * The home page is three admin-managed layout zones (Top/Middle/Footer —
 * Content > Widgets) wrapped around a fixed core of page furniture that
 * stays outside the widget system: the product carousels (live search-
 * ranked data, not placeable config), the marquee/offer-banner/newsletter/
 * Instagram sections (no admin config exists for these), and — as of the
 * ÉLUME restyle — Categories/Collections/Testimonials too, rendered
 * directly in the theme's own section order rather than through the
 * generic MIDDLE zone. Each one still defers to a REAL widget of its own
 * type if an admin has actually configured one (Content > Widgets), via
 * `hasMiddleWidget` below — so this doesn't remove that admin capability,
 * it just supplies a better-ordered default when nothing's configured yet
 * (today, for every store: zero real widgets exist in any environment
 * this session touched).
 */
export default async function HomePage() {
  const [bestsellers, newArrivals, topWidgets, middleWidgets, footerWidgets, categories] = await Promise.all([
    searchProducts({ pageSize: 8, page: 1 }),
    searchProducts({ pageSize: 8, page: 2 }),
    listWidgets('home', 'TOP'),
    listWidgets('home', 'MIDDLE'),
    listWidgets('home', 'FOOTER'),
    listCategories(),
  ]);

  const hasMiddleWidget = (type: string) => middleWidgets.some((w) => w.type === type);
  const rootCategories = categories.filter((c) => c.parentId === null);

  return (
    <div>
      <WidgetZone widgets={topWidgets} section="TOP" />
      <MarqueeStrip />

      {!hasMiddleWidget('CATEGORY_GRID') ? <FeaturedCategories categories={rootCategories} /> : null}

      <ProductCarousel
        title="Bestsellers"
        subtitle="People keep coming back for these"
        hits={withMockImages(bestsellers.hits)}
        seeAllHref="/products"
        badge="bestseller"
      />

      {!hasMiddleWidget('PROMO_BANNER_GRID') ? (
        <Reveal>
          <PromoBanners />
        </Reveal>
      ) : null}

      <Reveal>
        <ProductCarousel title="New Arrivals" subtitle="Fresh in" hits={withMockImages(newArrivals.hits)} seeAllHref="/products" badge="new" />
      </Reveal>

      <Reveal>
        <PromoOfferBanner />
      </Reveal>

      {!hasMiddleWidget('TESTIMONIAL_LIST') ? (
        <Reveal>
          <Testimonials />
        </Reveal>
      ) : null}

      {/* Renders only what an admin has actually configured (Content > Widgets)
          — e.g. a real CATEGORY_GRID instance the `hasMiddleWidget` checks above
          already suppressed the matching fixed section for. Nothing to render
          here today (middleWidgets is empty), same as every other environment
          this session touched. */}
      <WidgetZone widgets={middleWidgets} section="MIDDLE" />

      <Reveal>
        <NewsletterSection />
      </Reveal>
      <Reveal>
        <InstagramGallery />
      </Reveal>
      <WidgetZone widgets={footerWidgets} section="FOOTER" />
    </div>
  );
}
