'use client';

import { useActionState, useState } from 'react';
import { deleteVariant, type ActionState } from './variants-actions';
import type { Variant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function DeleteVariantDialog({ productPublicId, variant }: { productPublicId: string; variant: Variant }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteVariant, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            Delete
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Variant — {variant.sku}</DialogTitle>
          <DialogDescription>
            If it still has stock in any warehouse, deletion is blocked — adjust its stock to zero first.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="productPublicId" value={productPublicId} />
          <input type="hidden" name="variantPublicId" value={variant.publicId} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Variant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
