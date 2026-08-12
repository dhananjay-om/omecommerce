'use client';

import { useActionState, useState } from 'react';
import { setPrice, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function SetPriceDialog({ priceListCode }: { priceListCode: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setPrice, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Set Price</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Price — {priceListCode}</DialogTitle>
          <DialogDescription>Find the variant&apos;s Public ID on its product detail page.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="priceListCode" value={priceListCode} />
          <div className="space-y-2">
            <Label htmlFor="sp-variantId">Variant Public ID</Label>
            <Input id="sp-variantId" name="variantId" required placeholder="e.g. 019f6979-c446-7016-98da-629179a3094a" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-price">Price</Label>
            <Input id="sp-price" name="price" required placeholder="e.g. 19.99" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Set Price'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
