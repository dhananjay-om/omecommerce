'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { formatPrice } from '@/lib/format-price';
import { api } from '@/lib/axios';
import { useCartStore } from '@/store/cart-store';
import { useWishlistStore } from '@/store/wishlist-store';
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
 * extra round trip, not a shortcut. No rating stars here: `SearchHit` has
 * no rating aggregate at grid scale — that stays PDP-only, where it's real.
 */
function discountPercent(price: string, mrp: string): number | null {
  const priceNum = Number(price);
  const mrpNum = Number(mrp);
  if (!(mrpNum > priceNum) || mrpNum <= 0) return null;
  return Math.round(((mrpNum - priceNum) / mrpNum) * 100);
}

export function ProductCard({ hit, badge }: { hit: SearchHit; badge?: 'new' | 'bestseller' }) {
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
    } catch {
      toast.error('Could not add to cart — open the product page instead.');
    } finally {
      setQuickAdding(false);
    }
  }

  return (
    <div className="group relative flex flex-col">
      <div className="product-img-wrap relative aspect-[3/4] overflow-hidden rounded-2xl bg-sand">
        <Link href={href} className="block size-full">
          {hit.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
            <img src={hit.imageUrl} alt={hit.name} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-slate">No image</div>
          )}
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
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(hit.productId);
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
        <Link href={href}>
          <h3 className="line-clamp-2 text-sm leading-snug font-medium text-jet transition-colors hover:text-champagne">
            {hit.name}
          </h3>
        </Link>
        <span className="mt-auto flex flex-wrap items-baseline gap-1.5 pt-1.5">
          <span className="text-sm font-semibold text-jet">
            {hit.priceDisplay && hit.currency ? formatPrice(hit.priceDisplay, hit.currency) : 'Price unavailable'}
          </span>
          {percentOff !== null && hit.currency ? (
            <span className="text-xs text-slate line-through">{formatPrice(hit.mrpDisplay!, hit.currency)}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
