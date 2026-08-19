'use client';

import { useActionState, useState } from 'react';
import { setCompanyCredit, type ActionState } from './actions';
import type { CompanyCreditAccountView, CreditTermsType } from '@/lib/types';
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

export const TERMS_LABELS: Record<CreditTermsType, string> = {
  NET_15: 'Net 15',
  NET_30: 'Net 30',
  NET_45: 'Net 45',
  NET_60: 'Net 60',
};

const initialState: ActionState = { error: null, success: false };

/** One dialog for both flows: setting up a new credit account and editing an existing one's
 *  limit/terms — `account` null means "not configured yet", pre-filling nothing. */
export function CompanyCreditTermsDialog({
  publicId,
  account,
}: {
  publicId: string;
  account: CompanyCreditAccountView | null;
}) {
  const [open, setOpen] = useState(false);
  const action = setCompanyCredit.bind(null, publicId);
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
          <Button variant={account ? 'outline' : 'default'}>
            {account ? 'Edit Terms' : 'Set Up Credit Terms'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Credit Terms' : 'Set Up Credit Terms'}</DialogTitle>
          {account ? null : (
            <DialogDescription>
              Creates a Net-X credit account for this company, defaulting currency to its
              website&apos;s base currency.
            </DialogDescription>
          )}
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-limit">Credit Limit</Label>
            <Input
              id="cc-limit"
              name="creditLimit"
              defaultValue={account?.creditLimit}
              placeholder="e.g. 5000.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-terms">Terms</Label>
            <Select name="termsType" defaultValue={account?.termsType ?? 'NET_30'}>
              <SelectTrigger id="cc-terms" className="w-full">
                <SelectValue>{(value: CreditTermsType) => TERMS_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TERMS_LABELS) as CreditTermsType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TERMS_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : account ? 'Save Terms' : 'Set Up Credit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
