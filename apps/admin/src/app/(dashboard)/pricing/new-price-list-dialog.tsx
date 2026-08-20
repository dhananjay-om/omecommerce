'use client';

import { useActionState, useState } from 'react';
import { createPriceList, type ActionState } from './actions';
import type { CustomerGroup } from '@/lib/types';
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
} from '@/components/ui/dialog';

const PRICE_LIST_TYPES = ['BASE', 'WHOLESALE', 'B2B', 'SPECIAL'];
const NO_GROUP = '__none__';

const initialState: ActionState = { error: null, success: false };

export function NewPriceListDialog({
  defaultCurrency,
  customerGroups,
}: {
  defaultCurrency?: string;
  customerGroups: CustomerGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPriceList, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Price List</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Price List</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pl-code">Code</Label>
            <Input id="pl-code" name="code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-name">Name</Label>
            <Input id="pl-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-currency">Currency</Label>
            <Input
              id="pl-currency"
              name="currency"
              required
              maxLength={3}
              placeholder="USD"
              defaultValue={defaultCurrency}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-type">Type</Label>
            <Select name="type" defaultValue="BASE">
              <SelectTrigger id="pl-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_LIST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-priority">Priority</Label>
            <Input id="pl-priority" name="priority" type="number" step="1" defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-customer-group">Customer group</Label>
            <Select name="customerGroupCode" defaultValue={NO_GROUP}>
              <SelectTrigger id="pl-customer-group" className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === NO_GROUP
                      ? 'None (base pricing)'
                      : (customerGroups.find((g) => g.code === value)?.name ?? value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP}>None (base pricing)</SelectItem>
                {customerGroups.map((g) => (
                  <SelectItem key={g.code} value={g.code}>
                    {g.name} ({g.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Scopes this price list to a group — only that group&apos;s customers/companies see it.
              Can&apos;t be changed after creation. Manage groups on the Customer Groups page.
            </p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Price List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
