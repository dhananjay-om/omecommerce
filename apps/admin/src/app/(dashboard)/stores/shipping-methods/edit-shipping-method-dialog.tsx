'use client';

import { useActionState, useState } from 'react';
import { updateShippingMethod, type ActionState } from './actions';
import type { ShippingMethod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function EditShippingMethodDialog({ method }: { method: ShippingMethod }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateShippingMethod, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Shipping Method — {method.code}</DialogTitle>
          <DialogDescription>
            The code and currency can&apos;t be changed after creation — create a new method instead
            if you need a different currency.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={method.code} />
          <div className="space-y-2">
            <Label htmlFor="edit-sm-name">Name</Label>
            <Input id="edit-sm-name" name="name" required defaultValue={method.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-sm-flatRate">Flat rate ({method.currency})</Label>
            <Input id="edit-sm-flatRate" name="flatRate" defaultValue={method.flatRate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-sm-active">Status</Label>
            <Select name="isActive" defaultValue={method.isActive ? 'true' : 'false'}>
              <SelectTrigger id="edit-sm-active" className="w-full">
                <SelectValue>{(value: string) => (value === 'true' ? 'Active' : 'Inactive')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Inactive methods stop being offered at checkout immediately.</p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
