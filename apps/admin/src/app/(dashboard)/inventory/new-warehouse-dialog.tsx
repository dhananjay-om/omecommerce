'use client';

import { useActionState, useState } from 'react';
import { createWarehouse, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const WAREHOUSE_TYPES = ['PHYSICAL', 'VIRTUAL', 'DROPSHIP'];

const initialState: ActionState = { error: null, success: false };

export function NewWarehouseDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createWarehouse, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Warehouse</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Warehouse</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wh-code">Code</Label>
            <Input id="wh-code" name="code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wh-name">Name</Label>
            <Input id="wh-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wh-type">Type</Label>
            <Select name="type" defaultValue="PHYSICAL">
              <SelectTrigger id="wh-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Warehouse'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
