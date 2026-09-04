'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';
import { formatPrice } from '@/lib/format-price';
import { useCartStore } from '@/store/cart-store';
import { useWishlistStore } from '@/store/wishlist-store';

export interface EnrichedWishlistItem {
  productId: string;
  sku: string;
  slug: string;
  name: string | null;
  imageUrl: string;
  price: string | null;
  mrp: string | null;
  currency: string;
  inStock: boolean;
  /** The product's first in-stock (or first, if none in stock) variant —
   *  null only for a product with zero real variants, which shouldn't
   *  happen for anything actually purchasable but is handled rather than
   *  assumed. Add to Cart is disabled without one. */
  variantId: string | null;
}

export function WishlistList({ initialItems }: { initialItems: EnrichedWishlistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [addingId, setAddingId] = useState<string | null>(null);
  const syncRemoved = useWishlistStore((s) => s.syncRemoved);
  const addLine = useCartStore((s) => s.addLine);

  async function remove(productId: string) {
    try {
      await api.delete(`/wishlist/${productId}`);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      // Keep every heart icon elsewhere in the app (product cards, PDP) in
      // sync with this removal too — same shared store, see its own doc
      // comment on why this isn't just `toggle()`.
      syncRemoved(productId);
      toast.success('Removed from wishlist');
    } catch {
      toast.error('Could not remove item.');
    }
  }

  async function addToCart(item: EnrichedWishlistItem) {
    if (!item.variantId || addingId) return;
    setAddingId(item.productId);
    try {
      await addLine(item.variantId, 1);
      toast.success('Added to cart');
    } catch {
      toast.error('Could not add to cart. Please try again.');
    } finally {
      setAddingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-jet">Wishlist</h2>
        <p className="mt-2 text-slate">Your wishlist is empty.</p>
        <Link href="/products" className="mt-3 inline-block text-sm font-medium text-champagne hover:text-jet">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-jet">Wishlist</h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex items-center gap-4 rounded-2xl border border-ghost bg-ivory p-3"
          >
            <Link href={`/${item.slug}.html`} className="size-20 shrink-0 overflow-hidden rounded-xl bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL when real, curated stock photo otherwise */}
              <img src={item.imageUrl} alt={item.name ?? item.sku} className="size-full object-cover" />
            </Link>

            <div className="min-w-0 flex-1">
              <Link href={`/${item.slug}.html`} className="font-medium text-jet hover:text-champagne">
                {item.name ?? item.sku}
              </Link>
              <p className="text-xs text-slate">SKU: {item.sku}</p>
              <div className="mt-1 flex items-center gap-2">
                {item.price ? (
                  <span className="text-sm font-semibold text-jet">{formatPrice(item.price, item.currency)}</span>
                ) : (
                  <span className="text-sm text-slate">Price unavailable</span>
                )}
                {item.mrp && item.price && Number(item.mrp) > Number(item.price) ? (
                  <span className="text-xs text-slate line-through">{formatPrice(item.mrp, item.currency)}</span>
                ) : null}
                {!item.inStock ? <span className="text-xs font-medium text-rose">Out of stock</span> : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <Button variant="ghost" size="icon-sm" aria-label="Remove from wishlist" onClick={() => remove(item.productId)}>
                <TrashIcon className="size-4 text-rose" />
              </Button>
              <Button
                variant="cta"
                size="sm"
                disabled={!item.inStock || !item.variantId || addingId === item.productId}
                onClick={() => addToCart(item)}
              >
                {addingId === item.productId ? 'Adding…' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
