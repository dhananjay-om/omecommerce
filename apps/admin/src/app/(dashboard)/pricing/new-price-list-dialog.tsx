'use client';

import { useActionState, useState } from 'react';
import { createPriceList, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const PRICE_LIST_TYPES = ['BASE', 'WHOLESALE', 'B2B', 'SPECIAL'];

const initialState: ActionState = { error: null, success: false };

export function NewPriceListDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPriceList, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Price List</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Price List</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pl-code">Code</Label>
            <Input id="pl-code" name="code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-name">Name</Label>
            <Input id="pl-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-currency">Currency</Label>
            <Input id="pl-currency" name="currency" required maxLength={3} placeholder="USD" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-type">Type</Label>
            <Select name="type" defaultValue="BASE">
              <SelectTrigger id="pl-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_LIST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-priority">Priority</Label>
            <Input id="pl-priority" name="priority" type="number" step="1" defaultValue={0} />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Price List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
