import Link from 'next/link';
import { formatPrice } from '@/lib/format-price';
import type { SearchHit } from '@/types/product';

/**
 * The one product-card component reused by every listing surface (home
 * sliders, PLP grid, related products) so hover/price/layout stay
 * consistent. Plain `<img>`, not `next/image` — the backend's presigned
 * MinIO/S3 URLs are per-request and don't fit `next/image`'s remote-pattern
 * allowlist (same constraint documented for the admin app's product grid).
 * Hover lift is pure CSS, not Framer Motion — this renders dozens of times
 * per PLP grid, and a JS-driven animation on every card would cost far more
 * than the visual payoff over a transform/shadow transition.
 */
export function ProductCard({ hit }: { hit: SearchHit }) {
  return (
    <Link
      href={`/products/${hit.productId}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-background transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {hit.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
          <img
            src={hit.imageUrl}
            alt={hit.name}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">No image</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm font-medium">{hit.name}</span>
        <span className="mt-auto text-sm font-semibold text-foreground">
          {hit.priceDisplay && hit.currency ? formatPrice(hit.priceDisplay, hit.currency) : 'Price unavailable'}
        </span>
      </div>
    </Link>
  );
}
