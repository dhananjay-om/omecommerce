'use client';

import { useActionState, useState } from 'react';
import { createCustomerGroup, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export function NewCustomerGroupDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCustomerGroup, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Customer Group</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Customer Group</DialogTitle>
          <DialogDescription>
            Reference this group&apos;s code from a Company (for its buyers) or a price list (to
            scope it) to give that group different pricing.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cg-code">Code</Label>
            <Input id="cg-code" name="code" required placeholder="e.g. WHOLESALE" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cg-name">Name</Label>
            <Input id="cg-name" name="name" required placeholder="e.g. Wholesale Buyers" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cg-default">Default group</Label>
            <Select name="isDefault" defaultValue="false">
              <SelectTrigger id="cg-default" className="w-full">
                <SelectValue>{(value: string) => (value === 'true' ? 'Yes' : 'No')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes — make this the default group</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave as No unless you specifically want this to replace the current system default.
            </p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
