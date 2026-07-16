'use client';

import { useActionState, useState } from 'react';
import { refundOrder, type ActionState } from './actions';
import type { OrderLine } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function RefundDialog({ orderPublicId, lines }: { orderPublicId: string; lines: OrderLine[] }) {
  const [open, setOpen] = useState(false);
  const action = refundOrder.bind(null, orderPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const refundableLines = lines.filter((l) => l.qty - l.refundedQty > 0);
  if (refundableLines.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Refund</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund Order</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {refundableLines.map((line) => {
            const remaining = line.qty - line.refundedQty;
            return (
              <div key={line.sku} className="space-y-2">
                <input type="hidden" name="sku" value={line.sku} />
                <Label htmlFor={`refund-${line.sku}`}>
                  {line.sku} — {line.name} (refundable {remaining})
                </Label>
                <Input key={remaining} id={`refund-${line.sku}`} name="qty" type="number" min={0} max={remaining} defaultValue={0} />
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <input id="restock" name="restock" type="checkbox" className="size-4" defaultChecked />
            <Label htmlFor="restock">Restock refunded quantity</Label>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Refunding…' : 'Refund'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
