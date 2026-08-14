'use client';

import { useActionState, useState } from 'react';
import { createTaxClass, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewTaxClassDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTaxClass, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Tax Class</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Tax Class</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tc-code">Code</Label>
            <Input id="tc-code" name="code" required placeholder="e.g. GST18" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tc-name">Name</Label>
            <Input id="tc-name" name="name" required placeholder="e.g. GST 18%" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tc-percent">GST rate (%)</Label>
            <Input id="tc-percent" name="percent" type="number" step="0.01" min="0" max="99.99" required placeholder="e.g. 18" />
            <p className="text-xs text-muted-foreground">
              The combined rate — CGST+SGST (intra-state) or IGST (inter-state) are derived from this at checkout, not set separately.
            </p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Tax Class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
