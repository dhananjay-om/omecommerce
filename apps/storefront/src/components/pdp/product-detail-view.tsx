import Link from 'next/link';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import type { ProductDetail, SearchHit } from '@/types/product';
import type { Category } from '@/types/category';
import { SITE_URL } from '@/lib/config';
import { cn } from '@/lib/utils';
import { getProductReviews } from '@/services/reviews.service';
import { ProductGallery } from '@/components/pdp/product-gallery';
import { ProductPurchasePanel } from '@/components/pdp/product-purchase-panel';
import { ProductTabs } from '@/components/pdp/product-tabs';
import { PincodeChecker } from '@/components/pdp/pincode-checker';
import { ProductOffers } from '@/components/pdp/product-offers';
import { RecentlyViewed } from '@/components/pdp/recently-viewed';
import { ProductCarousel } from '@/components/product/product-carousel';

/** A product's `meta_title`/`meta_description`/`meta_keywords` are SEO-content attributes set
 * on the admin's product-edit page — they belong in <head> tags for search engines/social
 * previews, never as visible page content. Falls back to a synthesized title/description when
 * an admin hasn't filled them in for a given product. */
export function stringAttr(attributes: Record<string, unknown>, code: string): string | null {
  const value = attributes[code];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * The actual PDP body — shared between the canonical /{slug}.html route
 * (app/[slug]/page.tsx) and reused nowhere else (the old /products/[id]
 * route now just redirects there, see that file's own comment on why).
 * Split out so both a slug-driven and (if ever needed again) an id-driven
 * entry point can render the identical page without duplicating this much
 * markup — same reasoning generateMetadata's own logic stays inline in each
 * route file instead (metadata is cheap enough not to need sharing).
 */
export async function ProductDetailView({
  product,
  relatedHits,
  breadcrumbCategory,
}: {
  product: ProductDetail;
  relatedHits: SearchHit[];
  breadcrumbCategory: Category | undefined;
}) {
  const priceNumber = product.price ? Number(product.price) : null;
  const shortDescription = stringAttr(product.attributes, 'short_description');
  const description = stringAttr(product.attributes, 'description');
  const reviews = await getProductReviews(product.publicId);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name ?? product.sku,
    sku: product.sku,
    image: product.media.map((m) => m.url),
    brand: product.brandSlug ? { '@type': 'Brand', name: product.brandSlug } : undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/${product.slug}.html`,
      priceCurrency: product.currency,
      price: priceNumber ?? undefined,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground hover:underline">
          Home
        </Link>
        {breadcrumbCategory ? (
          <span className="flex items-center gap-1">
            <span>/</span>
            <Link href={`/collections/${breadcrumbCategory.slug}`} className="hover:text-foreground hover:underline">
              {breadcrumbCategory.nameDefault ?? breadcrumbCategory.slug}
            </Link>
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <span>/</span>
          <span className="text-foreground">{product.name ?? product.sku}</span>
        </span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ProductGallery media={product.media} productName={product.name ?? product.sku} />

        <div>
          {product.brandSlug ? (
            <Link href={`/brands/${product.brandSlug}`} className="text-sm font-medium text-primary hover:underline">
              {product.brandSlug}
            </Link>
          ) : null}
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{product.name ?? product.sku}</h1>
          <p className="mt-1 text-sm text-muted-foreground">SKU: {product.sku}</p>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) =>
                reviews.averageRating && i < Math.round(reviews.averageRating) ? (
                  <StarIcon key={i} className="size-4 text-cta" />
                ) : (
                  <StarOutlineIcon key={i} className={cn('size-4', reviews.averageRating ? 'text-muted-foreground/40' : 'text-cta opacity-40')} />
                ),
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {reviews.total > 0 && reviews.averageRating
                ? `${reviews.averageRating.toFixed(1)} (${reviews.total} review${reviews.total === 1 ? '' : 's'})`
                : 'No ratings yet'}
            </span>
          </div>

          <div className="mt-4">
            <ProductPurchasePanel
              productId={product.publicId}
              currency={product.currency}
              variants={product.variants}
              pricesIncludeTax={product.pricesIncludeTax}
            />
          </div>

          <div className="mt-4 space-y-3">
            <PincodeChecker />
            <ProductOffers productId={product.publicId} />
          </div>

          {shortDescription ? <p className="mt-6 text-sm text-muted-foreground">{shortDescription}</p> : null}
        </div>
      </div>

      <div className="mt-10">
        <ProductTabs productId={product.publicId} sku={product.sku} description={description} attributes={product.attributes} reviews={reviews} />
      </div>

      <ProductCarousel title="Related Products" hits={relatedHits} />
      <RecentlyViewed currentProductId={product.publicId} />
    </div>
  );
}
