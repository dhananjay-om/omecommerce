'use client';

import { useActionState, useState } from 'react';
import { updatePaymentMethod, type ActionState } from './actions';
import type { PaymentMethod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function EditPaymentMethodDialog({ method }: { method: PaymentMethod }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updatePaymentMethod, initialState);
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
          <DialogTitle>Edit Payment Method — {method.code}</DialogTitle>
          <DialogDescription>The code and type can&apos;t be changed after creation — create a new method instead.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={method.code} />
          <div className="space-y-2">
            <Label htmlFor="edit-pm-name">Name</Label>
            <Input id="edit-pm-name" name="name" required defaultValue={method.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pm-active">Status</Label>
            <Select name="isActive" defaultValue={method.isActive ? 'true' : 'false'}>
              <SelectTrigger id="edit-pm-active" className="w-full">
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
