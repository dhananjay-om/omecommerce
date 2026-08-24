import { ImageIcon } from 'lucide-react';
import type { ProductDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { PageBreadcrumb } from '@/components/page-breadcrumb';

/**
 * Shared header for the product View and Edit pages — matches the mock's
 * product-detail `.page-head` exactly: a small thumbnail (or a fallback
 * swatch) beside the title, with SKU + status riding along in the subline
 * instead of the title row. `actions` slots in each page's own buttons
 * (View/Edit differ between the two pages).
 */
export function ProductDetailHeader({ product, actions }: { product: ProductDetail; actions: React.ReactNode }) {
  const thumbnail = product.media.find((m) => m.role === 'THUMBNAIL') ?? product.media[0];

  return (
    <>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/products' }, { label: 'Products', href: '/products' }, { label: product.name ?? product.sku }]} />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
            <img src={thumbnail.url} alt="" className="size-11 shrink-0 rounded-lg border object-cover" />
          ) : (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="size-5" />
            </div>
          )}
          <div>
            <h1 className="text-[1.32rem] font-extrabold tracking-tight">{product.name ?? product.sku}</h1>
            <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              SKU {product.sku}
              <Badge variant={statusBadgeVariant(product.status)}>{product.status}</Badge>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </>
  );
}
