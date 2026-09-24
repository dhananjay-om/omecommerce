'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cartErrorMessage } from '@/lib/cart-error';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { formatPrice } from '@/lib/format-price';
import { api } from '@/lib/axios';
import { useCartStore } from '@/store/cart-store';
import { useWishlistStore } from '@/store/wishlist-store';
import { resolveProductImage } from '@/lib/mock-images';
import type { ProductDetail, SearchHit } from '@/types/product';

/**
 * The one product-card component reused by every listing surface (home
 * sliders, PLP grid, related products) so hover/price/layout stay
 * consistent. Plain `<img>`, not `next/image` — the backend's presigned
 * MinIO/S3 URLs are per-request and don't fit `next/image`'s remote-pattern
 * allowlist (same constraint documented for the admin app's product grid).
 * Hover lift is pure CSS, not Framer Motion — this renders dozens of times
 * per PLP grid, and a JS-driven animation on every card would cost far more
 * than the visual payoff over a transform/shadow transition.
 *
 * ÉLUME restyle: split into an image Link + a separate title Link (rather
 * than one big Link wrapping the whole card) so the hover-reveal wishlist
 * and Quick Add controls can be real, clickable, non-nested-in-an-anchor
 * elements — the reference theme's own ProductCard uses the same split.
 * Both are wired to real state: `useWishlistStore` (already used on the
 * PDP) and a real add-to-cart. `SearchHit` carries no variantId (it's a
 * search-index projection, not the full product), so Quick Add resolves
 * the product's first in-stock variant via the same `/api/products/:id`
 * route `recently-viewed.tsx` already calls, then adds it through the same
 * `useCartStore.addLine` the PDP's own Add to Cart button uses — a real
 * extra round trip, not a shortcut.
 *
 * Color swatches are REAL: `hit.swatches` comes from the search index (each
 * variant-forming option that has a hex swatch, e.g. Color=Red) and the row
 * is omitted entirely when a product has none.
 *
 * The star rating is REAL too: `hit.ratingAvg` / `hit.ratingCount` come from
 * the search index (approved reviews only) and the rating is omitted for a
 * product with no reviews. Its index entry is refreshed whenever an admin
 * approves/rejects a review.
 *
 * Still a placeholder (per the user's own explicit call): the brand eyebrow —
 * `SearchHit` carries no brand at grid scale, so it cycles through this
 * store's own real brand names as a stand-in. A real one would need the
 * brand adding to the search index / `SearchHit`, not just this component.
 *
 * Image: `resolveProductImage(hit.sku, hit.name, hit.imageUrl)`, not a
 * blind `hit.imageUrl` OR a blind mock — a real image wins whenever one
 * exists and isn't one of the seed script's known-fake placeholder photos
 * (see lib/mock-images.ts for exactly how that's decided). Went through
 * two real bug reports to land here: first, a card showed a nicer mock
 * photo than the PDP's real-but-ugly placeholder; fixing THAT by always
 * mocking then hid a genuinely real, admin-uploaded photo on a real
 * product. `resolveProductImage` is the one shared place both this
 * component and the PDP gallery call through, so they can't disagree.
 */
function discountPercent(price: string, mrp: string): number | null {
  const priceNum = Number(price);
  const mrpNum = Number(mrp);
  if (!(mrpNum > priceNum) || mrpNum <= 0) return null;
  return Math.round(((mrpNum - priceNum) / mrpNum) * 100);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/** Cap so a product with many colors doesn't overflow the card — the rest collapse into "+N". */
const MAX_SWATCHES = 5;

const PLACEHOLDER_BRANDS = ['Nova Electronics', 'Urban Threads', 'HomeStyle'];

function placeholderBrand(productId: string): string {
  return PLACEHOLDER_BRANDS[hashString(productId) % PLACEHOLDER_BRANDS.length]!;
}

export function ProductCard({ hit, badge }: { hit: SearchHit; badge?: 'new' | 'bestseller' }) {
  const swatches = hit.swatches ?? [];
  const ratingAvg = hit.ratingAvg ?? null;
  const ratingCount = hit.ratingCount ?? 0;
  const percentOff =
    hit.priceDisplay && hit.mrpDisplay ? discountPercent(hit.priceDisplay, hit.mrpDisplay) : null;
  // Falls back to the old id-based URL (itself now a permanent redirect to
  // the slug URL — see app/products/[id]/page.tsx) for a search hit indexed
  // before this field existed — a rolling deploy has a real window where an
  // OpenSearch document hasn't been reindexed yet; this keeps that window's
  // links working instead of ever rendering "/undefined.html".
  const href = hit.slug ? `/${hit.slug}.html` : `/products/${hit.productId}`;

  const isWishlisted = useWishlistStore((s) => s.has(hit.productId));
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const addLine = useCartStore((s) => s.addLine);
  const [quickAdding, setQuickAdding] = useState(false);

  async function quickAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (quickAdding) return;
    setQuickAdding(true);
    try {
      const { data: product } = await api.get<ProductDetail>(`/products/${hit.productId}`);
      const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
      if (!variant) throw new Error('no purchasable variant');
      await addLine(variant.publicId, 1);
      toast.success('Added to cart');
    } catch (err) {
      toast.error(cartErrorMessage(err, 'Could not add to cart — open the product page instead.'));
    } finally {
      setQuickAdding(false);
    }
  }

  return (
    <div className="group relative flex flex-col">
      <div className="product-img-wrap relative aspect-[3/4] overflow-hidden rounded-2xl bg-sand">
        <Link href={href} className="block size-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL when real, curated stock photo otherwise */}
          <img src={resolveProductImage(hit.sku, hit.name, hit.imageUrl)} alt={hit.name} className="size-full object-cover" />
        </Link>

        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {badge === 'new' ? (
            <span className="bg-jet px-2 py-0.5 text-[10px] font-medium tracking-widest text-white uppercase">New</span>
          ) : null}
          {badge === 'bestseller' ? (
            <span className="bg-champagne px-2 py-0.5 text-[10px] font-medium tracking-widest text-white uppercase">Bestseller</span>
          ) : null}
          {percentOff !== null ? (
            <span className="bg-rose px-2 py-0.5 text-[10px] font-medium tracking-widest text-white uppercase">{percentOff}% off</span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={async (e) => {
            e.preventDefault();
            const result = await toggleWishlist(hit.productId);
            if (result === 'login-required') toast.error('Log in to save items to your wishlist.');
            else if (result === 'error') toast.error('Could not update your wishlist. Please try again.');
          }}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-white focus-visible:opacity-100"
        >
          {isWishlisted ? (
            <HeartIconSolid className="size-4 text-rose" />
          ) : (
            <HeartIcon className="size-4 text-charcoal" />
          )}
        </button>

        <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-200 group-hover:translate-y-0">
          <button
            type="button"
            onClick={quickAdd}
            disabled={quickAdding}
            className="w-full bg-jet/90 py-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-jet disabled:opacity-60"
          >
            {quickAdding ? 'Adding…' : 'Quick Add'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-1 flex-col px-0.5">
        {/* Brand on the left, real color dots on the right (omitted entirely when the
            product has none). On the brand line — not their own row — so a product
            with colors is never taller than one without, and prices stay aligned. */}
        <div className="flex h-4 items-center justify-between gap-2">
          <p className="truncate text-[10px] tracking-widest text-slate uppercase">{placeholderBrand(hit.productId)}</p>
          {swatches.length > 0 ? (
            <span className="flex shrink-0 items-center gap-1">
              {swatches.slice(0, MAX_SWATCHES).map((sw) => (
                <span key={sw.hex} title={sw.label} className="size-2.5 rounded-full border border-ghost" style={{ backgroundColor: sw.hex }} />
              ))}
              {swatches.length > MAX_SWATCHES ? <span className="text-[10px] text-slate">+{swatches.length - MAX_SWATCHES}</span> : null}
            </span>
          ) : null}
        </div>
        <Link href={href}>
          {/* min-h reserves exactly two lines (2 × text-sm leading-snug) even for a
             one-line title, so price/discount/swatches start at the same height
             on every card regardless of how long each product name is. */}
          <h3 className="mt-0.5 line-clamp-2 min-h-[2.42rem] text-sm leading-snug font-medium text-jet transition-colors hover:text-champagne">
            {hit.name}
          </h3>
        </Link>
        <div className="mt-auto pt-1.5">
          {/* On narrow (phone) cards, price + struck-through MRP + stars don't always fit on
              one line and wrap to two — reserve two lines there (items-start, so every
              card's price sits at the same top edge) instead of letting one card grow. */}
          <div className="flex min-h-[2.75rem] items-start justify-between gap-1.5 sm:min-h-0 sm:items-center">
            <span className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-sm font-semibold text-jet">
                {hit.priceDisplay && hit.currency ? formatPrice(hit.priceDisplay, hit.currency) : 'Price unavailable'}
              </span>
              {percentOff !== null && hit.currency ? (
                <span className="text-xs text-slate line-through">{formatPrice(hit.mrpDisplay!, hit.currency)}</span>
              ) : null}
            </span>
            {/* Real rating (approved reviews only) — omitted entirely when the product has none. */}
            {ratingCount > 0 && ratingAvg !== null ? (
              <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs sm:pt-0" title={`${ratingAvg} out of 5 from ${ratingCount} review${ratingCount === 1 ? '' : 's'}`}>
                <span className="text-champagne" aria-hidden>★</span>
                <span className="font-medium text-jet">{ratingAvg.toFixed(1)}</span>
                <span className="text-slate">({ratingCount})</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
