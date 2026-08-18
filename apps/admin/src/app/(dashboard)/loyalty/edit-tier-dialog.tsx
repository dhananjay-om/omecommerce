'use client';

import { useActionState, useState } from 'react';
import { updateLoyaltyTier, type ActionState } from './actions';
import type { LoyaltyTier } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';

const initialState: ActionState = { error: null, success: false };

export function EditTierDialog({ programPublicId, tier }: { programPublicId: string; tier: LoyaltyTier }) {
  const [open, setOpen] = useState(false);
  const action = updateLoyaltyTier.bind(null, programPublicId, tier.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Edit ${tier.name}`}>
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tier — {tier.name}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-tier-name-${tier.id}`}>Name</Label>
            <Input id={`edit-tier-name-${tier.id}`} name="name" required defaultValue={tier.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-tier-threshold-${tier.id}`}>Threshold points</Label>
            <Input id={`edit-tier-threshold-${tier.id}`} name="thresholdPoints" required defaultValue={tier.thresholdPoints} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-tier-multiplier-${tier.id}`}>Earn multiplier</Label>
            <Input id={`edit-tier-multiplier-${tier.id}`} name="earnMultiplier" defaultValue={tier.earnMultiplier} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-tier-sort-${tier.id}`}>Sort order</Label>
            <Input id={`edit-tier-sort-${tier.id}`} name="sortOrder" type="number" step="1" defaultValue={tier.sortOrder} />
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
