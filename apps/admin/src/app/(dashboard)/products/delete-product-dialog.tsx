'use client';

import { useActionState, useState } from 'react';
import { deleteProduct, type ActionState } from './actions';
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
import { Trash2 } from 'lucide-react';

const initialState: ActionState = { error: null, success: false };

export function DeleteProductDialog({ publicId, sku }: { publicId: string; sku: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteProduct, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${sku}`}
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product — {sku}</DialogTitle>
          <DialogDescription>
            This removes it from every list, search, and the storefront. If it still has stock in any
            warehouse, deletion is blocked — adjust its stock to zero first. Past orders that included
            this product are unaffected either way; order lines keep their own snapshot of the name,
            SKU, and price.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="publicId" value={publicId} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
