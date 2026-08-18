'use client';

import { useActionState, useState } from 'react';
import { freezeWallet, unfreezeWallet, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** One dialog, two modes selected by the wallet's current status — freezing
 *  blocks further debits (credits still work), unfreezing restores them. */
export function WalletStatusDialog({ customerPublicId, status }: { customerPublicId: string; status: 'ACTIVE' | 'FROZEN' }) {
  const [open, setOpen] = useState(false);
  const frozen = status === 'FROZEN';
  const action = (frozen ? unfreezeWallet : freezeWallet).bind(null, customerPublicId);
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
          <Button variant="outline" className={frozen ? undefined : 'text-destructive hover:text-destructive'}>
            {frozen ? 'Unfreeze' : 'Freeze'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{frozen ? 'Unfreeze Wallet' : 'Freeze Wallet'}</DialogTitle>
          <DialogDescription>
            {frozen
              ? 'Restores this wallet to normal — credits and debits both work again.'
              : 'Blocks further debits from this wallet (redemptions, checkout tender once that ships) until unfrozen. Admin credits still work.'}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant={frozen ? 'default' : 'destructive'} disabled={pending}>
              {pending ? 'Saving…' : frozen ? 'Unfreeze Wallet' : 'Freeze Wallet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
