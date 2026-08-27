'use client';

import { useState } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PublicStore } from '@/lib/store-context';

/**
 * Replaces the announcement bar's old static "Ship to United States" text.
 * Receives the store list + current selection as props (fetched
 * server-side by its parent, avoiding a client-side waterfall). Switching
 * stores POSTs to /api/stores/select (sets the ome_store cookie, clears
 * the cart cookie — a cart's currency is locked in at creation, see that
 * route's own doc comment) then does a HARD reload, not router.refresh() —
 * refresh() only re-renders Server Components and would leave the Zustand
 * cart/auth/wishlist stores' client-side state stale.
 */
export function StoreSwitcher({ stores, selectedStoreViewId }: { stores: PublicStore[]; selectedStoreViewId: string }) {
  const [pending, setPending] = useState(false);
  const current = stores.find((s) => s.storeViewId === selectedStoreViewId);

  if (stores.length === 0) return null;

  async function selectStore(storeViewId: string) {
    if (storeViewId === selectedStoreViewId) return;
    setPending(true);
    await fetch('/api/stores/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeViewId }),
    });
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" disabled={pending} className="flex items-center gap-1 hover:underline disabled:opacity-60">
            <MapPinIcon className="size-3.5" />
            {pending ? 'Switching…' : `Shipping to ${current?.websiteName ?? 'Store'}`}
          </button>
        }
      />
      <DropdownMenuContent align="start">
        {stores.map((s) => (
          <DropdownMenuItem key={s.storeViewId} onClick={() => selectStore(s.storeViewId)}>
            {s.websiteName} ({s.currency})
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
