'use client';

import { useActionState, useState } from 'react';
import { updateCompanyMemberRole, type ActionState } from './actions';
import type { CompanyMember } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function ChangeMemberRoleDialog({ publicId, member }: { publicId: string; member: CompanyMember }) {
  const [open, setOpen] = useState(false);
  const action = updateCompanyMemberRole.bind(null, publicId, member.customerPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Change Role</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role — {member.email}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <Select name="role" defaultValue={member.role}>
            <SelectTrigger id={`cm-role-${member.customerPublicId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUYER">Buyer</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
