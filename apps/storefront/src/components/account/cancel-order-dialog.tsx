'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

/** Self-service cancel — POST /api/account/orders/:id/cancel, proxying to
 *  the backend's ownership-checked CancelCustomerOrder (same underlying
 *  CancelOrder usecase, and same eligibility guard, as the admin's own
 *  Cancel Order action: only while nothing has shipped yet). Refunds
 *  immediately, same as the admin action does — this isn't a request
 *  someone has to approve. */
export function CancelOrderDialog({ orderPublicId }: { orderPublicId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState('');
  const [refundTo, setRefundTo] = useState<'ORIGINAL_PAYMENT_METHOD' | 'WALLET'>('ORIGINAL_PAYMENT_METHOD');
  const [error, setError] = useState<string | null>(null);

  async function confirmCancel() {
    setPending(true);
    setError(null);
    try {
      await api.post(`/account/orders/${orderPublicId}/cancel`, { reason: reason.trim() || undefined, refundTo });
      toast.success('Order cancelled — your refund is on its way.');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not cancel this order.') : 'Could not cancel this order.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Cancel Order</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>This fully refunds and cancels your order. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Let us know why you're cancelling…" />
          </div>
          <div className="space-y-2">
            <Label>Refund to</Label>
            <RadioGroup value={refundTo} onValueChange={(v) => setRefundTo(v as 'ORIGINAL_PAYMENT_METHOD' | 'WALLET')}>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="ORIGINAL_PAYMENT_METHOD" />
                Original payment method
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="WALLET" />
                Store credit (wallet) — instant, use it on your next order
              </label>
            </RadioGroup>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={confirmCancel} disabled={pending}>
            {pending ? 'Cancelling…' : 'Confirm Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
