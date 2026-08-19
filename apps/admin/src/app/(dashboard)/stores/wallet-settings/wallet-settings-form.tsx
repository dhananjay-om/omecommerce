'use client';

import { useActionState } from 'react';
import { updateWalletSettings, type ActionState } from './actions';
import type { Website } from '@/lib/types';
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

const initialState: ActionState = { error: null, success: false };

export function WalletSettingsForm({ website }: { website: Website }) {
  const [state, formAction, pending] = useActionState(updateWalletSettings, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <input type="hidden" name="code" value={website.code} />
      <div className="space-y-2">
        <Label htmlFor={`wallet-enabled-${website.code}`}>Wallet payments</Label>
        <Select name="walletEnabled" defaultValue={website.walletEnabled ? 'true' : 'false'}>
          <SelectTrigger id={`wallet-enabled-${website.code}`} className="w-full">
            <SelectValue>
              {(value: string) =>
                value === 'true'
                  ? 'Enabled — shoppers can pay with wallet balance'
                  : 'Disabled — wallet tender hidden at checkout'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Enabled — shoppers can pay with wallet balance</SelectItem>
            <SelectItem value="false">Disabled — wallet tender hidden at checkout</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Store-wide switch — doesn&apos;t touch any customer&apos;s balance or an individual freeze
          already set on their Wallet tab.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`wallet-max-pct-${website.code}`}>Max % of order payable by wallet</Label>
        <Input
          id={`wallet-max-pct-${website.code}`}
          name="walletMaxPercentOfOrder"
          defaultValue={website.walletMaxPercentOfOrder ?? ''}
          placeholder="e.g. 50 for at most half the order"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for no cap — wallet may cover the full order (subject to balance).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`wallet-min-order-${website.code}`}>
          Minimum order value to use wallet
        </Label>
        <Input
          id={`wallet-min-order-${website.code}`}
          name="walletMinOrderValue"
          defaultValue={website.walletMinOrderValue ?? ''}
          placeholder="e.g. 500.00"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for no minimum — wallet tender is offered on any order size.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`wallet-max-amount-${website.code}`}>Max wallet amount per order</Label>
        <Input
          id={`wallet-max-amount-${website.code}`}
          name="walletMaxAmountPerOrder"
          defaultValue={website.walletMaxAmountPerOrder ?? ''}
          placeholder="e.g. 2000.00"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for no cap. Applied alongside the % cap above — whichever limit is lower wins.
        </p>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save Wallet Settings'}
      </Button>
    </form>
  );
}
