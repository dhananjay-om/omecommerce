'use client';

import { useActionState, useState } from 'react';
import { addCompanyMember, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function AddMemberDialog({ publicId }: { publicId: string }) {
  const [open, setOpen] = useState(false);
  const action = addCompanyMember.bind(null, publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Add Member</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Company Member</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cm-add-email">Email</Label>
            <Input id="cm-add-email" name="email" type="email" required placeholder="buyer@example.com" />
            <p className="text-xs text-muted-foreground">Must already be a registered customer.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cm-add-role">Role</Label>
            <Select name="role" defaultValue="BUYER">
              <SelectTrigger id="cm-add-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUYER">Buyer</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
