import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { apiGet, ApiError } from '@/lib/api-client';
import type { ProductDetail } from '@/lib/types';
import { SITE_URL } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { NavTabs } from '@/components/nav-tabs';
import { ProductDetailHeader } from '../product-detail-header';

/**
 * Shared chrome for every /products/[id]/* tab — matches the mock's
 * product-detail page exactly: image + title + SKU/status header, then a
 * horizontal tab strip (Overview/Variants/Inventory/Pricing/Media/SEO/
 * Channels/Analytics/Orders/Reviews/Metafields/Activity), same pattern as
 * the Orders detail layout. Only Overview/Variants/Inventory/Pricing/
 * Media/SEO have real data behind them; the other 6 render
 * `InlineComingSoon` — see each tab's own page.tsx.
 *
 * This REPLACES the old split of a read-only "View" page + a separate
 * "/edit" page with its own full form: the mock's Overview tab already
 * has directly-editable fields, so View and Edit are now the same page
 * (`/products/[id]/edit` redirects here — see that route's page.tsx).
 */
export default async function ProductDetailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;

  let product: ProductDetail;
  try {
    product = await apiGet<ProductDetail>(`/admin/v1/products/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <ProductDetailHeader
        product={product}
        actions={
          <>
            <Button variant="outline" size="sm" render={<a href={`${SITE_URL}/${product.slug}.html`} target="_blank" rel="noreferrer" />}>
              Preview
              <ExternalLink className="size-3.5" />
            </Button>
            {/* Duplicate/Archive match the mock's action row but have no
                real backend endpoint yet — disabled rather than faked, so
                clicking is honest about not doing anything yet (same
                "don't fake a working action" rule used everywhere else in
                this revamp). */}
            <Button variant="outline" size="sm" disabled title="Coming soon">
              Duplicate
            </Button>
            <Button variant="outline" size="sm" disabled title="Coming soon">
              Archive
            </Button>
          </>
        }
      />

      <div className="mt-6">
        <NavTabs
          items={[
            { href: `/products/${product.publicId}`, label: 'Overview' },
            { href: `/products/${product.publicId}/variants`, label: 'Variants' },
            { href: `/products/${product.publicId}/inventory`, label: 'Inventory' },
            { href: `/products/${product.publicId}/pricing`, label: 'Pricing' },
            { href: `/products/${product.publicId}/media`, label: 'Media' },
            { href: `/products/${product.publicId}/seo`, label: 'SEO' },
            { href: `/products/${product.publicId}/channels`, label: 'Channels' },
            { href: `/products/${product.publicId}/analytics`, label: 'Analytics' },
            { href: `/products/${product.publicId}/orders`, label: 'Orders' },
            { href: `/products/${product.publicId}/reviews`, label: 'Reviews' },
            { href: `/products/${product.publicId}/metafields`, label: 'Metafields' },
            { href: `/products/${product.publicId}/activity`, label: 'Activity' },
          ]}
        />
        <div className="mt-6 min-w-0">{children}</div>
      </div>
    </div>
  );
}
