'use client';

import { useActionState, useState } from 'react';
import { createReturn, type ActionState } from './actions';
import type { OrderLine } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** Records a return that already happened — admin-only (confirmed
 *  decision, no customer self-service in this pass). Same eligible-lines
 *  shape as RefundDialog (qty - refundedQty > 0 — an already-fully-
 *  refunded line has nothing left to return), but restock is captured
 *  per line here, not once for the whole request, since OrderReturnLine
 *  itself stores it per line. */
export function CreateReturnDialog({ orderPublicId, lines }: { orderPublicId: string; lines: OrderLine[] }) {
  const [open, setOpen] = useState(false);
  const action = createReturn.bind(null, orderPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const returnableLines = lines.filter((l) => l.qty - l.refundedQty > 0);
  if (returnableLines.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Create Return</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Return</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="return-reason">Reason</Label>
            <Textarea id="return-reason" name="reason" rows={2} placeholder="Why is this being returned?" required />
          </div>
          {returnableLines.map((line) => {
            const remaining = line.qty - line.refundedQty;
            return (
              <div key={line.sku} className="space-y-2 rounded-md border p-3">
                <input type="hidden" name="sku" value={line.sku} />
                <Label htmlFor={`return-${line.sku}`}>
                  {line.sku} — {line.name} (returnable {remaining})
                </Label>
                <Input key={remaining} id={`return-${line.sku}`} name="qty" type="number" min={0} max={remaining} defaultValue={0} />
                <div className="flex items-center gap-2">
                  <input id={`return-restock-${line.sku}`} name={`restock-${line.sku}`} type="checkbox" className="size-4" defaultChecked />
                  <Label htmlFor={`return-restock-${line.sku}`} className="text-xs font-normal text-muted-foreground">
                    Restock this line
                  </Label>
                </div>
              </div>
            );
          })}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Return'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
