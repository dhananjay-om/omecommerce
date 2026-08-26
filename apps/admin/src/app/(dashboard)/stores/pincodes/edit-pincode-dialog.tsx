'use client';

import { useActionState, useState } from 'react';
import { updatePincode, type ActionState } from './actions';
import type { Pincode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function EditPincodeDialog({ pincode }: { pincode: Pincode }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updatePincode, initialState);
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
          <DialogTitle>Edit Pincode — {pincode.code}</DialogTitle>
          <DialogDescription>The pincode itself can&apos;t be changed after creation — add a new one instead.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={pincode.code} />
          <div className="space-y-2">
            <Label htmlFor="edit-pin-city">City</Label>
            <Input id="edit-pin-city" name="city" required defaultValue={pincode.city} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pin-state">State</Label>
            <Input id="edit-pin-state" name="state" required defaultValue={pincode.state} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pin-days">Estimated delivery days</Label>
            <Input id="edit-pin-days" name="estimatedDays" type="number" min={0} max={60} required defaultValue={pincode.estimatedDays} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pin-cod">Cash on Delivery</Label>
            <Select name="codAvailable" defaultValue={pincode.codAvailable ? 'true' : 'false'}>
              <SelectTrigger id="edit-pin-cod" className="w-full">
                <SelectValue>{(value: string) => (value === 'true' ? 'Available' : 'Not available')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Available</SelectItem>
                <SelectItem value="false">Not available</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pin-active">Status</Label>
            <Select name="isActive" defaultValue={pincode.isActive ? 'true' : 'false'}>
              <SelectTrigger id="edit-pin-active" className="w-full">
                <SelectValue>{(value: string) => (value === 'true' ? 'Active' : 'Inactive')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Inactive reads as &quot;not serviceable&quot; on the storefront, same as never having added it.</p>
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
