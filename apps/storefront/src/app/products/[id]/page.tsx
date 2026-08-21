import { notFound, permanentRedirect } from 'next/navigation';
import { getProduct } from '@/services/products.service';
import { ApiError } from '@/lib/api-client';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Legacy PDP URL, kept working as a permanent redirect rather than removed —
 * this exact path was already live/indexed/shared before the canonical URL
 * scheme moved to flat "/{slug}.html" (app/[slug]/page.tsx). A 308 here (not
 * a client-side bounce) tells search engines to transfer this page's ranking
 * to the new URL instead of indexing two equivalent pages, and updates any
 * bookmark/shared link's browser history entry the next time it's followed.
 */
export default async function LegacyProductDetailPage({ params }: Props) {
  const { id } = await params;

  let product;
  try {
    product = await getProduct(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  permanentRedirect(`/${product.slug}.html`);
}
