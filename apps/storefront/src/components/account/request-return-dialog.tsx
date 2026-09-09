'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { api } from '@/lib/axios';
import type { OrderLineView } from '@/types/order';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

/** Self-service return request — POST /api/account/orders/:id/return,
 *  proxying to the backend's ownership-checked CreateCustomerReturn (same
 *  underlying CreateReturn usecase an admin's own "Create Return" dialog
 *  uses). This only ever creates a REQUESTED return — it still goes
 *  through the same admin-moderated Approve -> Receive -> Refund pipeline
 *  as an admin-logged one; submitting this doesn't refund anything by
 *  itself, it just starts the process, with the refund destination
 *  already chosen so nobody has to be asked again once it's approved. */
export function RequestReturnDialog({ orderPublicId, lines }: { orderPublicId: string; lines: OrderLineView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState('');
  const [refundTo, setRefundTo] = useState<'ORIGINAL_PAYMENT_METHOD' | 'WALLET'>('ORIGINAL_PAYMENT_METHOD');
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const returnableLines = lines.filter((l) => l.qty - l.refundedQty > 0);
  if (returnableLines.length === 0) return null;

  async function submit() {
    setError(null);
    const requestLines = returnableLines
      .map((l) => ({ sku: l.sku, qty: qtys[l.sku] ?? 0 }))
      .filter((l) => l.qty > 0);
    if (requestLines.length === 0) {
      setError('Enter a quantity for at least one item.');
      return;
    }
    if (!reason.trim()) {
      setError('Tell us why you want to return this.');
      return;
    }

    setPending(true);
    try {
      await api.post(`/account/orders/${orderPublicId}/return`, { reason: reason.trim(), lines: requestLines, refundTo });
      toast.success('Return requested — we’ll review it and follow up.');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not submit this return.') : 'Could not submit this return.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Request Return</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a Return</DialogTitle>
          <DialogDescription>We&apos;ll review your request once the item is back with us.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="return-reason">Reason</Label>
            <Textarea id="return-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why are you returning this?" required />
          </div>
          <div className="space-y-3">
            {returnableLines.map((line) => {
              const remaining = line.qty - line.refundedQty;
              return (
                <div key={line.sku} className="space-y-1.5 rounded-md border p-3">
                  <Label htmlFor={`return-qty-${line.sku}`} className="text-sm font-normal">
                    {line.name} <span className="text-muted-foreground">(up to {remaining})</span>
                  </Label>
                  <Input
                    id={`return-qty-${line.sku}`}
                    type="number"
                    min={0}
                    max={remaining}
                    value={qtys[line.sku] ?? 0}
                    onChange={(e) => setQtys((prev) => ({ ...prev, [line.sku]: Math.max(0, Math.min(remaining, Number(e.target.value) || 0)) }))}
                  />
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label>Refund to (once approved)</Label>
            <RadioGroup value={refundTo} onValueChange={(v) => setRefundTo(v as 'ORIGINAL_PAYMENT_METHOD' | 'WALLET')}>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="ORIGINAL_PAYMENT_METHOD" />
                Original payment method
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="WALLET" />
                Store credit (wallet) — instant once approved
              </label>
            </RadioGroup>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Submitting…' : 'Submit Return Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
