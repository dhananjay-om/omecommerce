'use client';

import { useActionState, useState } from 'react';
import { createPincode, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewPincodeDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPincode, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Pincode</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Pincode</DialogTitle>
          <DialogDescription>
            Only pincodes added here show as deliverable on the storefront&apos;s pincode checker —
            anything else reads as &quot;not serviceable yet.&quot;
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin-code">Pincode</Label>
            <Input id="pin-code" name="code" required maxLength={6} placeholder="e.g. 110001" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin-city">City</Label>
            <Input id="pin-city" name="city" required placeholder="e.g. New Delhi" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin-state">State</Label>
            <Input id="pin-state" name="state" required placeholder="e.g. Delhi" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin-days">Estimated delivery days</Label>
            <Input id="pin-days" name="estimatedDays" type="number" min={0} max={60} required defaultValue={5} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin-cod">Cash on Delivery</Label>
            <Select name="codAvailable" defaultValue="true">
              <SelectTrigger id="pin-cod" className="w-full">
                <SelectValue>{(value: string) => (value === 'true' ? 'Available' : 'Not available')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Available</SelectItem>
                <SelectItem value="false">Not available</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add Pincode'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
