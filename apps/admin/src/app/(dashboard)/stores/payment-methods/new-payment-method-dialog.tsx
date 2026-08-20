'use client';

import { useActionState, useState } from 'react';
import { createPaymentMethod, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

const TYPE_LABELS: Record<string, string> = { COD: 'Cash on Delivery', ONLINE: 'Online Gateway' };

export function NewPaymentMethodDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPaymentMethod, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Payment Method</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Payment Method</DialogTitle>
          <DialogDescription>
            Cash on Delivery is fully wired up — checkout skips charging a card and the order stays
            &quot;awaiting payment&quot; until you mark it paid once the cash is collected. Online
            Gateway methods can be registered today, but all currently route through the same test
            gateway until a real provider (CCAvenue, PayU, ...) is connected — that&apos;s future work.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pm-code">Code</Label>
            <Input id="pm-code" name="code" required placeholder="e.g. COD" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-name">Name</Label>
            <Input id="pm-name" name="name" required placeholder="e.g. Cash on Delivery" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-type">Type</Label>
            <Select name="type" defaultValue="COD">
              <SelectTrigger id="pm-type" className="w-full">
                <SelectValue>{(value: string) => TYPE_LABELS[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COD">Cash on Delivery</SelectItem>
                <SelectItem value="ONLINE">Online Gateway</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Can&apos;t be changed after creation.</p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Payment Method'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
