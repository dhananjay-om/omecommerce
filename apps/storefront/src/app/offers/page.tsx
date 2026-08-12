import type { Metadata } from 'next';
import { PromoBanners } from '@/components/home/promo-banners';
import { ProductCarousel } from '@/components/product/product-carousel';
import { searchProducts } from '@/services/products.service';

export const metadata: Metadata = { title: 'Offers' };

/** No promotions/discount engine exists (plan/14 context) — this is a category-jump page plus a relevance-sorted product list, honestly, not fake percent-off badges. */
export default async function OffersPage() {
  const result = await searchProducts({ pageSize: 12 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Offers</h1>
      <p className="mb-6 text-sm text-muted-foreground">Explore our current categories and popular picks.</p>
      <PromoBanners />
      <ProductCarousel title="Popular Picks" hits={result.hits} seeAllHref="/products" />
    </div>
  );
}
