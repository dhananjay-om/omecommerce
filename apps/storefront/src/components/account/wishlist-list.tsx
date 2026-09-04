'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';
import { useWishlistStore } from '@/store/wishlist-store';
import type { WishlistItem } from '@/types/customer';

export function WishlistList({ initialItems }: { initialItems: WishlistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const syncRemoved = useWishlistStore((s) => s.syncRemoved);

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
            className="flex items-center justify-between gap-3 rounded-2xl border border-ghost bg-ivory px-4 py-3"
          >
            <div>
              <Link href={`/${item.slug}.html`} className="font-medium text-jet hover:text-champagne">
                {item.name ?? item.sku}
              </Link>
              <p className="text-xs text-slate">SKU: {item.sku}</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove from wishlist" onClick={() => remove(item.productId)}>
              <TrashIcon className="size-4 text-rose" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
