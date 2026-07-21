'use client';

import { useActionState, useState } from 'react';
import { createInvoice, type ActionState } from './actions';
import type { OrderLine, OrderInvoice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

function alreadyInvoiced(invoices: OrderInvoice[], sku: string): number {
  return invoices.flatMap((inv) => inv.lines).filter((l) => l.sku === sku).reduce((sum, l) => sum + l.qty, 0);
}

export function CreateInvoiceDialog({ orderPublicId, lines, invoices }: { orderPublicId: string; lines: OrderLine[]; invoices: OrderInvoice[] }) {
  const [open, setOpen] = useState(false);
  const action = createInvoice.bind(null, orderPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const invoiceableLines = lines
    .map((line) => ({ line, remaining: line.qty - alreadyInvoiced(invoices, line.sku) }))
    .filter(({ remaining }) => remaining > 0);
  if (invoiceableLines.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Create Invoice</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>Defaults to invoicing every line&apos;s full remaining quantity — supports partial invoicing across multiple invoices.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {invoiceableLines.map(({ line, remaining }) => (
            <div key={line.sku} className="space-y-2">
              <input type="hidden" name="sku" value={line.sku} />
              <Label htmlFor={`invoice-${line.sku}`}>
                {line.sku} — {line.name} (remaining {remaining})
              </Label>
              <Input key={remaining} id={`invoice-${line.sku}`} name="qty" type="number" min={0} max={remaining} defaultValue={remaining} />
            </div>
          ))}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
