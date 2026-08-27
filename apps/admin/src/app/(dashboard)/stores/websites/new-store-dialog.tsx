'use client';

import { useActionState, useState } from 'react';
import { createStore, type ActionState } from './actions';
import type { Currency } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewStoreDialog({ currencies }: { currencies: Currency[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createStore, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const labels = Object.fromEntries(currencies.map((c) => [c.code, `${c.code} — ${c.name}`]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Store</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Store</DialogTitle>
          <DialogDescription>
            Creates the underlying store and default storefront view automatically. Currency can&apos;t be
            changed after creation — a cart&apos;s currency is locked in the moment it&apos;s created, so
            get this right up front.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-code">Website code</Label>
            <Input id="store-code" name="websiteCode" required placeholder="e.g. india_retail" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-name">Name</Label>
            <Input id="store-name" name="websiteName" required placeholder="e.g. India" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-currency">Currency</Label>
            {currencies.length === 0 ? (
              <p className="text-xs text-destructive">
                No currencies registered yet — add one on Currency Setup first.
              </p>
            ) : (
              <Select name="currency" defaultValue={currencies[0]!.code}>
                <SelectTrigger id="store-currency" className="w-full">
                  <SelectValue>{(value: string) => labels[value] ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || currencies.length === 0}>
              {pending ? 'Creating…' : 'Create Store'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
