import dynamic from 'next/dynamic';
import { searchProducts } from '@/services/products.service';
import { listWidgets } from '@/services/widget.service';
import { WidgetZone } from '@/components/widgets/widget-zone';
import { ProductCarousel } from '@/components/product/product-carousel';
import { InstagramGallery } from '@/components/home/instagram-gallery';
import { Reveal } from '@/components/motion/reveal';
import { Skeleton } from '@/components/ui/skeleton';

// Below-the-fold and its own client bundle (form state) — deferred so it
// isn't part of the initial JS needed to render the hero/featured sections.
const NewsletterSection = dynamic(() => import('@/components/home/newsletter-section').then((m) => m.NewsletterSection), {
  loading: () => <Skeleton className="h-48 w-full" />,
});

/**
 * The home page is three admin-managed layout zones (Top/Middle/Footer —
 * Content > Widgets) wrapped around a fixed core of live product carousels
 * plus the Newsletter/Instagram placeholders, which stay outside the widget
 * system (carousels pull live search-ranked data, not simple placeable
 * config; Newsletter/Instagram are unrelated, already-documented gaps, not
 * "content"). "Best Selling"/"New Arrivals" are both, honestly, relevance-
 * sorted search results — there's no sales-count or createdAt sort in the
 * search API (see search-products.usecase.ts's VALID_SORTS) to back a real
 * ranking. They're pulled from different result pages so the two carousels
 * aren't literal duplicates, not because page 2 is actually "newer."
 */
export default async function HomePage() {
  const [featured, bestSelling, newArrivals, topWidgets, middleWidgets, footerWidgets] = await Promise.all([
    searchProducts({ pageSize: 10, page: 1 }),
    searchProducts({ pageSize: 10, page: 1, sort: 'price_desc' }),
    searchProducts({ pageSize: 10, page: 2 }),
    listWidgets('home', 'TOP'),
    listWidgets('home', 'MIDDLE'),
    listWidgets('home', 'FOOTER'),
  ]);

  return (
    <div>
      <WidgetZone widgets={topWidgets} section="TOP" />
      <ProductCarousel title="Featured Products" hits={featured.hits} seeAllHref="/products" />
      <Reveal>
        <ProductCarousel title="Best Selling" subtitle="Popular picks, ranked by relevance" hits={bestSelling.hits} seeAllHref="/products" />
      </Reveal>
      <Reveal>
        <ProductCarousel title="New Arrivals" hits={newArrivals.hits} seeAllHref="/products" />
      </Reveal>
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
