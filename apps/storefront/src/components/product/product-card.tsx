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
/** Whole-percent discount for the "X% off" badge — only shown when mrp is a genuine
 *  compare-at price above the selling price, same `mrp > price` gate every other MRP
 *  display in this system uses. */
function discountPercent(price: string, mrp: string): number | null {
  const priceNum = Number(price);
  const mrpNum = Number(mrp);
  if (!(mrpNum > priceNum) || mrpNum <= 0) return null;
  return Math.round(((mrpNum - priceNum) / mrpNum) * 100);
}

export function ProductCard({ hit }: { hit: SearchHit }) {
  const percentOff =
    hit.priceDisplay && hit.mrpDisplay ? discountPercent(hit.priceDisplay, hit.mrpDisplay) : null;
  // Falls back to the old id-based URL (itself now a permanent redirect to
  // the slug URL — see app/products/[id]/page.tsx) for a search hit indexed
  // before this field existed — a rolling deploy has a real window where an
  // OpenSearch document hasn't been reindexed yet; this keeps that window's
  // links working instead of ever rendering "/undefined.html".
  const href = hit.slug ? `/${hit.slug}.html` : `/products/${hit.productId}`;
  return (
    <Link
      href={href}
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
        <span className="mt-auto flex flex-wrap items-baseline gap-1.5">
          <span className="text-sm font-semibold text-foreground">
            {hit.priceDisplay && hit.currency ? formatPrice(hit.priceDisplay, hit.currency) : 'Price unavailable'}
          </span>
          {percentOff !== null && hit.currency ? (
            <>
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(hit.mrpDisplay!, hit.currency)}
              </span>
              <span className="text-xs font-medium text-success">{percentOff}% off</span>
            </>
          ) : null}
        </span>
      </div>
    </Link>
  );
}
