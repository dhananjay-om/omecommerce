import dynamic from 'next/dynamic';
import { listCategories } from '@/services/category.service';
import { listBrands } from '@/services/brand.service';
import { searchProducts } from '@/services/products.service';
import { getCmsBlockOrUndefined } from '@/services/content.service';
import { heroBannerSectionSchema, promoBannersSectionSchema, whyChooseUsSectionSchema, testimonialsSectionSchema, parseHomeSection } from '@/lib/home-sections';
import { HeroBanner } from '@/components/home/hero-banner';
import { FeaturedCategories } from '@/components/home/featured-categories';
import { ProductCarousel } from '@/components/product/product-carousel';
import { PromoBanners } from '@/components/home/promo-banners';
import { TopBrands } from '@/components/home/top-brands';
import { WhyChooseUs } from '@/components/home/why-choose-us';
import { Testimonials } from '@/components/home/testimonials';
import { InstagramGallery } from '@/components/home/instagram-gallery';
import { Reveal } from '@/components/motion/reveal';
import { Skeleton } from '@/components/ui/skeleton';

// Below-the-fold and its own client bundle (form state) — deferred so it
// isn't part of the initial JS needed to render the hero/featured sections.
const NewsletterSection = dynamic(() => import('@/components/home/newsletter-section').then((m) => m.NewsletterSection), {
  loading: () => <Skeleton className="h-48 w-full" />,
});

/**
 * The 12-section home page (plan/14 Phase 2). "Best Selling" and "New
 * Arrivals" are both, honestly, relevance-sorted search results — there's no
 * sales-count or createdAt sort in the search API (see search-products.usecase.ts's
 * VALID_SORTS) to back a real ranking. They're pulled from different result
 * pages so the two carousels aren't literal duplicates, not because page 2 is
 * actually "newer."
 */
export default async function HomePage() {
  const [categories, brands, featured, bestSelling, newArrivals, heroBlock, promoBlock, whyChooseUsBlock, testimonialsBlock] = await Promise.all([
    listCategories(),
    listBrands(),
    searchProducts({ pageSize: 10, page: 1 }),
    searchProducts({ pageSize: 10, page: 1, sort: 'price_desc' }),
    searchProducts({ pageSize: 10, page: 2 }),
    getCmsBlockOrUndefined('home_hero_banner'),
    getCmsBlockOrUndefined('home_promo_banners'),
    getCmsBlockOrUndefined('home_why_choose_us'),
    getCmsBlockOrUndefined('home_testimonials'),
  ]);

  // Each admin-managed section falls back to its component's own hardcoded
  // default when the block is missing/unpublished/malformed — a site that
  // never touches Content > Home Page renders byte-identical to before this
  // feature existed.
  const hero = parseHomeSection(heroBlock?.body, heroBannerSectionSchema);
  const promo = parseHomeSection(promoBlock?.body, promoBannersSectionSchema);
  const whyChooseUs = parseHomeSection(whyChooseUsBlock?.body, whyChooseUsSectionSchema);
  const testimonials = parseHomeSection(testimonialsBlock?.body, testimonialsSectionSchema);

  return (
    <div>
      <HeroBanner slides={hero?.slides} />
      <Reveal>
        <FeaturedCategories categories={categories} />
      </Reveal>
      <ProductCarousel title="Featured Products" hits={featured.hits} seeAllHref="/products" />
      <Reveal>
        <PromoBanners banners={promo?.banners} />
      </Reveal>
      <Reveal>
        <ProductCarousel title="Best Selling" subtitle="Popular picks, ranked by relevance" hits={bestSelling.hits} seeAllHref="/products" />
      </Reveal>
      <Reveal>
        <ProductCarousel title="New Arrivals" hits={newArrivals.hits} seeAllHref="/products" />
      </Reveal>
      <Reveal>
        <TopBrands brands={brands} />
      </Reveal>
      <Reveal>
        <WhyChooseUs features={whyChooseUs?.features} />
      </Reveal>
      <Reveal>
        <Testimonials testimonials={testimonials?.testimonials} />
      </Reveal>
      <Reveal>
        <NewsletterSection />
      </Reveal>
      <Reveal>
        <InstagramGallery />
      </Reveal>
    </div>
  );
}
