'use client';

import { useActionState, useState } from 'react';
import { updatePriceList, type ActionState } from './actions';
import type { PriceList } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const PRICE_LIST_TYPES = ['BASE', 'WHOLESALE', 'B2B', 'SPECIAL'];

const initialState: ActionState = { error: null, success: false };

export function EditPriceListDialog({ priceList }: { priceList: PriceList }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updatePriceList, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Price List — {priceList.code}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={priceList.code} />
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={priceList.code} disabled />
            <p className="text-xs text-muted-foreground">Code can&apos;t be changed after creation.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`epl-name-${priceList.code}`}>Name</Label>
            <Input id={`epl-name-${priceList.code}`} name="name" required defaultValue={priceList.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`epl-currency-${priceList.code}`}>Currency</Label>
            <Input
              id={`epl-currency-${priceList.code}`}
              name="currency"
              required
              maxLength={3}
              defaultValue={priceList.currency}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`epl-type-${priceList.code}`}>Type</Label>
            <Select name="type" defaultValue={priceList.type}>
              <SelectTrigger id={`epl-type-${priceList.code}`} className="w-full">
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
            <Label htmlFor={`epl-priority-${priceList.code}`}>Priority</Label>
            <Input
              id={`epl-priority-${priceList.code}`}
              name="priority"
              type="number"
              step="1"
              defaultValue={priceList.priority}
            />
            <p className="text-xs text-muted-foreground">
              Higher priority price lists are preferred when more than one applies to a customer.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`epl-active-${priceList.code}`}>Status</Label>
            <Select name="isActive" defaultValue={priceList.isActive ? 'true' : 'false'}>
              <SelectTrigger id={`epl-active-${priceList.code}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Inactive price lists are hidden from checkout and product pricing views but keep their prices.
            </p>
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
