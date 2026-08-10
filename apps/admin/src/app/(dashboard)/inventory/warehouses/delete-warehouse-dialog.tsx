'use client';

import { useActionState, useState } from 'react';
import { deleteWarehouse, type ActionState } from '../actions';
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

export function DeleteWarehouseDialog({ code, name }: { code: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteWarehouse, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Warehouse — {name}</DialogTitle>
          <DialogDescription>
            This removes it from every list and product-edit page but keeps its stock history. A warehouse
            that still has on-hand or reserved stock can&apos;t be deleted — adjust its stock to zero first.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Warehouse'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
