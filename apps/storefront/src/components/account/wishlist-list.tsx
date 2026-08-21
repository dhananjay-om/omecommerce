'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';
import type { WishlistItem } from '@/types/customer';

export function WishlistList({ initialItems }: { initialItems: WishlistItem[] }) {
  const [items, setItems] = useState(initialItems);

  async function remove(productId: string) {
    try {
      await api.delete(`/wishlist/${productId}`);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      toast.success('Removed from wishlist');
    } catch {
      toast.error('Could not remove item.');
    }
  }

  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Wishlist</h2>
        <p className="mt-2 text-muted-foreground">Your wishlist is empty.</p>
        <Link href="/products" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Wishlist</h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Link href={`/${item.slug}.html`} className="font-medium hover:underline">
                {item.name ?? item.sku}
              </Link>
              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove from wishlist" onClick={() => remove(item.productId)}>
              <TrashIcon className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
