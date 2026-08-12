'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart-store';
import type { CartLine } from '@/types/cart';

export function CartLineRow({ line, currency }: { line: CartLine; currency: string }) {
  const [pending, setPending] = useState(false);
  const addLine = useCartStore((s) => s.addLine);
  const removeLine = useCartStore((s) => s.removeLine);

  async function setQty(qty: number) {
    if (qty < 1) return;
    setPending(true);
    try {
      await addLine(line.variantId, qty);
    } catch {
      toast.error('Could not update quantity. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await removeLine(line.variantId);
    } catch {
      toast.error('Could not remove item. Please try again.');
      setPending(false);
    }
  }

  return (
    <div className="flex gap-4 border-b py-4 last:border-b-0">
      <div className="size-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
          <img src={line.imageUrl} alt={line.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">No image</div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2">
        <div>
          <p className="font-medium">{line.name}</p>
          <p className="text-xs text-muted-foreground">SKU: {line.sku}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {line.price ? `${currency} ${Number(line.price).toFixed(2)} each` : 'Price unavailable'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending || line.qty <= 1}
              onClick={() => setQty(line.qty - 1)}
              aria-label="Decrease quantity"
            >
              <MinusIcon className="size-4" />
            </Button>
            <span className="w-8 text-center text-sm">{line.qty}</span>
            <Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => setQty(line.qty + 1)} aria-label="Increase quantity">
              <PlusIcon className="size-4" />
            </Button>
          </div>
          <Button variant="ghost" size="icon-sm" disabled={pending} onClick={remove} aria-label="Remove item">
            <TrashIcon className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="text-right font-semibold whitespace-nowrap">
        {line.lineTotal ? `${currency} ${Number(line.lineTotal).toFixed(2)}` : '—'}
      </div>
    </div>
  );
}
