'use client';

import { useActionState, useState } from 'react';
import { adjustStock, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const REASONS = ['PURCHASE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'CORRECTION'];

const initialState: ActionState = { error: null, success: false };

export function AdjustStockDialog({ warehouseCode }: { warehouseCode: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(adjustStock, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Adjust Stock</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock — {warehouseCode}</DialogTitle>
          <DialogDescription>
            Find the variant&apos;s Public ID on its product detail page, then enter a signed quantity delta here.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="warehouseCode" value={warehouseCode} />
          <div className="space-y-2">
            <Label htmlFor="variantId">Variant Public ID</Label>
            <Input id="variantId" name="variantId" required placeholder="e.g. 019f6979-c446-7016-98da-629179a3094a" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delta">Quantity delta</Label>
            <Input id="delta" name="delta" type="number" step="1" required placeholder="e.g. 10 or -2" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Select name="reason" defaultValue="PURCHASE">
              <SelectTrigger id="reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" name="note" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adjusting…' : 'Adjust Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
