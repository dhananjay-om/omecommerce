import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StarIcon } from '@heroicons/react/24/solid';
import { getProduct, searchProducts } from '@/services/products.service';
import { listCategories } from '@/services/category.service';
import { ApiError } from '@/lib/api-client';
import { CATEGORY_FACET_CODE } from '@/lib/facet-codes';
import { SITE_URL } from '@/lib/config';
import { ProductGallery } from '@/components/pdp/product-gallery';
import { ProductActions } from '@/components/pdp/product-actions';
import { ProductTabs } from '@/components/pdp/product-tabs';
import { RecentlyViewed } from '@/components/pdp/recently-viewed';
import { ProductCarousel } from '@/components/product/product-carousel';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const product = await getProduct(id);
    const title = product.name ?? product.sku;
    const description = `${title} — ${product.price ? `${product.currency} ${Number(product.price).toFixed(2)}` : 'shop now'} at OMEShop.`;
    const image = product.media[0]?.url;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {};
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;

  let product;
  try {
    product = await getProduct(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const primaryCategoryId = product.categoryIds[0];
  const [related, categories] = await Promise.all([
    primaryCategoryId
      ? searchProducts({ filter: { [CATEGORY_FACET_CODE]: primaryCategoryId }, pageSize: 9 })
      : Promise.resolve({ total: 0, page: 1, pageSize: 0, hits: [], facets: {} }),
    listCategories(),
  ]);
  const relatedHits = related.hits.filter((h) => h.productId !== product.publicId).slice(0, 8);
  const breadcrumbCategory = categories.find((c) => c.publicId === primaryCategoryId);

  const representativeVariant = product.variants[0];
  const priceNumber = product.price ? Number(product.price) : null;

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name ?? product.sku,
    sku: product.sku,
    image: product.media.map((m) => m.url),
    brand: product.brandSlug ? { '@type': 'Brand', name: product.brandSlug } : undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/products/${product.publicId}`,
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
            <div className="flex text-cta opacity-40" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} className="size-4" />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">No ratings yet</span>
          </div>

          <p className="mt-4 text-3xl font-bold">
            {priceNumber !== null ? `${product.currency} ${priceNumber.toFixed(2)}` : 'Price unavailable'}
          </p>
          <p className={`mt-1 text-sm font-medium ${product.inStock ? 'text-success' : 'text-destructive'}`}>
            {product.inStock ? 'In Stock' : 'Out of Stock'}
          </p>

          <div className="mt-6">
            <ProductActions productId={product.publicId} variant={representativeVariant} inStock={product.inStock} />
          </div>

          <ProductTabs sku={product.sku} attributes={product.attributes} />
        </div>
      </div>

      <ProductCarousel title="Related Products" hits={relatedHits} />
      <RecentlyViewed currentProductId={product.publicId} />
    </div>
  );
}
