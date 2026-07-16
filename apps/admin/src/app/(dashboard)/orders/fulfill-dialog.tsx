'use client';

import { useActionState, useState } from 'react';
import { fulfillOrder, type ActionState } from './actions';
import type { OrderLine } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function FulfillDialog({ orderPublicId, lines }: { orderPublicId: string; lines: OrderLine[] }) {
  const [open, setOpen] = useState(false);
  const action = fulfillOrder.bind(null, orderPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const fulfillableLines = lines.filter((l) => l.qty - l.fulfilledQty > 0);
  if (fulfillableLines.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Fulfill</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fulfill Order</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {fulfillableLines.map((line) => {
            const remaining = line.qty - line.fulfilledQty;
            return (
              <div key={line.sku} className="space-y-2">
                <input type="hidden" name="sku" value={line.sku} />
                <Label htmlFor={`fulfill-${line.sku}`}>
                  {line.sku} — {line.name} (remaining {remaining})
                </Label>
                <Input
                  key={remaining}
                  id={`fulfill-${line.sku}`}
                  name="qty"
                  type="number"
                  min={0}
                  max={remaining}
                  defaultValue={remaining}
                />
              </div>
            );
          })}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Fulfilling…' : 'Fulfill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
