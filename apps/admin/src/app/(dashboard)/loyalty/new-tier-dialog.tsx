'use client';

import { useActionState, useState } from 'react';
import { createLoyaltyTier, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewTierDialog({ programPublicId }: { programPublicId: string }) {
  const [open, setOpen] = useState(false);
  const action = createLoyaltyTier.bind(null, programPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Add Tier</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Tier</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-tier-name">Name</Label>
            <Input id="new-tier-name" name="name" required placeholder="e.g. Gold" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-tier-threshold">Threshold points</Label>
            <Input id="new-tier-threshold" name="thresholdPoints" required placeholder="e.g. 5000" />
            <p className="text-xs text-muted-foreground">Lifetime points required to reach this tier.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-tier-multiplier">Earn multiplier</Label>
            <Input id="new-tier-multiplier" name="earnMultiplier" placeholder="e.g. 1.5" />
            <p className="text-xs text-muted-foreground">Defaults to 1 (no bonus) if left blank.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-tier-sort">Sort order</Label>
            <Input id="new-tier-sort" name="sortOrder" type="number" step="1" defaultValue={0} />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Tier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
