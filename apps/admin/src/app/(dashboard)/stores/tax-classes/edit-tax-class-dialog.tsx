'use client';

import { useActionState, useState } from 'react';
import { updateTaxClass, type ActionState } from './actions';
import type { TaxClass } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** "0.1800" -> "18" for the percent-input's defaultValue. */
function fractionToPercent(rate: string): string {
  const n = Number(rate) * 100;
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

export function EditTaxClassDialog({ taxClass }: { taxClass: TaxClass }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateTaxClass, initialState);
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
          <DialogTitle>Edit Tax Class — {taxClass.code}</DialogTitle>
          <DialogDescription>The code can&apos;t be changed after creation — products reference it.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={taxClass.code} />
          <div className="space-y-2">
            <Label htmlFor="edit-tc-name">Name</Label>
            <Input id="edit-tc-name" name="name" required defaultValue={taxClass.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tc-percent">GST rate (%)</Label>
            <Input id="edit-tc-percent" name="percent" type="number" step="0.01" min="0" max="99.99" defaultValue={fractionToPercent(taxClass.rate)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tc-active">Status</Label>
            <Select name="isActive" defaultValue={taxClass.isActive ? 'true' : 'false'}>
              <SelectTrigger id="edit-tc-active" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
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
