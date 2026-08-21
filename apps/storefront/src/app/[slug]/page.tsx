import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductBySlug, searchProducts } from '@/services/products.service';
import { listCategories } from '@/services/category.service';
import { ApiError } from '@/lib/api-client';
import { CATEGORY_FACET_CODE } from '@/lib/facet-codes';
import { formatPrice } from '@/lib/format-price';
import { ProductDetailView, stringAttr } from '@/components/pdp/product-detail-view';

interface Props {
  params: Promise<{ slug: string }>;
}

/** The PDP's real, canonical entry point — flat root-level "product-name.html"
 * URLs (Magento-style), not nested under /products/. The route param is the
 * FULL segment including the suffix (Next.js has no built-in ".html routing" —
 * a dynamic segment just captures everything between slashes), so every
 * handler below strips it first; a request with no ".html" suffix at all
 * 404s rather than silently resolving (keeps exactly one canonical URL per
 * product instead of two equivalent ones, which would split SEO signal and
 * confuse which is "the" link to share). See create-product.usecase.ts's
 * RESERVED_SLUGS for why this root-level segment never actually collides
 * with /cart, /search, etc. — Next.js also always prefers a matching static
 * route over this dynamic one regardless. */
function parseSlug(rawSlug: string): string | null {
  if (!rawSlug.endsWith('.html')) return null;
  return rawSlug.slice(0, -'.html'.length);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = parseSlug(rawSlug);
  if (!slug) return {};
  try {
    const product = await getProductBySlug(slug);
    const fallbackTitle = product.name ?? product.sku;
    const fallbackDescription = `${fallbackTitle} — ${product.price ? formatPrice(product.price, product.currency) : 'shop now'} at OMEShop.`;
    const title = stringAttr(product.attributes, 'meta_title') ?? fallbackTitle;
    const description = stringAttr(product.attributes, 'meta_description') ?? fallbackDescription;
    const metaKeywords = stringAttr(product.attributes, 'meta_keywords');
    const keywords = metaKeywords ? metaKeywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined;
    const image = product.media[0]?.url;
    return {
      title,
      description,
      keywords,
      alternates: { canonical: `/${product.slug}.html` },
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
  const { slug: rawSlug } = await params;
  const slug = parseSlug(rawSlug);
  if (!slug) notFound();

  let product;
  try {
    product = await getProductBySlug(slug);
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

  return <ProductDetailView product={product} relatedHits={relatedHits} breadcrumbCategory={breadcrumbCategory} />;
}
