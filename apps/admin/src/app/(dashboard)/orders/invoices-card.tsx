'use client';

import { useActionState } from 'react';
import { regenerateInvoice, type ActionState } from './actions';
import type { OrderInvoice } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const initialState: ActionState = { error: null, success: false };

function RegenerateButton({ orderPublicId, invoicePublicId }: { orderPublicId: string; invoicePublicId: string }) {
  const action = regenerateInvoice.bind(null, orderPublicId, invoicePublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="inline">
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? 'Regenerating…' : 'Regenerate'}
      </Button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function InvoicesCard({ orderPublicId, invoices, currency }: { orderPublicId: string; invoices: OrderInvoice[]; currency: string }) {
  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">No invoices created yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice #</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Created</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => (
          <TableRow key={inv.publicId}>
            <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
            <TableCell>
              <Badge variant="secondary">{inv.status}</Badge>
            </TableCell>
            <TableCell>
              {currency} {inv.grandTotal}
            </TableCell>
            <TableCell>{new Date(inv.createdAt).toLocaleDateString('en-US')}</TableCell>
            <TableCell className="flex items-center gap-1">
              <a href={`/admin/api/orders/${orderPublicId}/invoice/${inv.publicId}/pdf`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                Download
              </a>
              <RegenerateButton orderPublicId={orderPublicId} invoicePublicId={inv.publicId} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
