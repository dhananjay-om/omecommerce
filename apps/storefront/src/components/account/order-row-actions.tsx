'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/axios';

interface ReorderResult {
  cartPublicId: string;
  skipped: Array<{ sku: string; name: string; reason: string }>;
}

export function OrderRowActions({ orderPublicId }: { orderPublicId: string }) {
  const router = useRouter();
  const [reordering, setReordering] = useState(false);

  async function reorder() {
    setReordering(true);
    try {
      const res = await api.post<ReorderResult>(`/account/orders/${orderPublicId}/reorder`);
      const { skipped } = res.data;
      if (skipped.length > 0) {
        toast.warning(`Added to cart, but skipped ${skipped.length} item(s) no longer available: ${skipped.map((s) => s.sku).join(', ')}`);
      } else {
        toast.success('Added to your cart');
      }
      router.push('/cart');
    } catch {
      toast.error('Could not reorder — please try again.');
    } finally {
      setReordering(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Order actions">
            <EllipsisHorizontalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/account/orders/${orderPublicId}`}>View Order</Link>} />
        <DropdownMenuItem render={<Link href={`/account/orders/${orderPublicId}/tracking`}>Track Shipment</Link>} />
        <DropdownMenuItem render={<a href={`/api/account/orders/${orderPublicId}/invoice`} target="_blank" rel="noreferrer">Download Invoice</a>} />
        <DropdownMenuItem onClick={reorder} disabled={reordering}>
          {reordering ? 'Reordering…' : 'Reorder'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
