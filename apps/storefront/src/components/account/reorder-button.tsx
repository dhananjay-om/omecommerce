'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';

interface ReorderResult {
  cartPublicId: string;
  skipped: Array<{ sku: string; name: string; reason: string }>;
}

export function ReorderButton({ orderPublicId }: { orderPublicId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reorder() {
    setPending(true);
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
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={reorder} disabled={pending}>
      {pending ? 'Reordering…' : 'Reorder'}
    </Button>
  );
}
