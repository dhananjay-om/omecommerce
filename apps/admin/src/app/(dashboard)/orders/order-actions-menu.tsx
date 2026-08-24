'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { OrderDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreateInvoiceDialog, hasInvoiceableLines } from './create-invoice-dialog';
import { SendEmailDialog } from './send-email-dialog';
import { CloseOrderDialog, closeEligibility } from './close-order-dialog';
import { CancelDialog } from './cancel-dialog';

type ActionKey = 'invoice' | 'email' | 'close' | 'cancel';

/**
 * The order detail header's lower-frequency actions (Create Invoice, Send
 * Email, Close Order, Cancel Order) folded behind one "..." menu — matches
 * the mock's compact action-bar shape instead of every action sitting
 * inline as its own always-visible button. Mark as Paid / Fulfill / Refund
 * stay inline (their own dialogs, unchanged) since those are the actions a
 * merchant reaches for most often.
 *
 * Each dialog still renders itself, just externally controlled instead of
 * owning its own trigger button — this is base-ui's own documented pattern
 * for opening a dialog from a menu item (menu.md, "Open a dialog": control
 * the dialog's `open` state and set it imperatively from the item's
 * `onClick`, with the `Dialog.Root` rendered outside the menu's popup).
 */
export function OrderActionsMenu({ order }: { order: OrderDetail }) {
  const [openDialog, setOpenDialog] = useState<ActionKey | null>(null);

  const cancellable = !['CANCELLED', 'COMPLETED', 'CLOSED'].includes(order.status);
  const invoiceable = hasInvoiceableLines(order.lines, order.invoices);
  const { eligible: closeEligible } = closeEligibility(order);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More order actions</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {invoiceable ? <DropdownMenuItem onClick={() => setOpenDialog('invoice')}>Create Invoice</DropdownMenuItem> : null}
          <DropdownMenuItem onClick={() => setOpenDialog('email')}>Send Email</DropdownMenuItem>
          {closeEligible ? <DropdownMenuItem onClick={() => setOpenDialog('close')}>Close Order</DropdownMenuItem> : null}
          {cancellable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setOpenDialog('cancel')}>
                Cancel Order
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateInvoiceDialog
        orderPublicId={order.publicId}
        lines={order.lines}
        invoices={order.invoices}
        open={openDialog === 'invoice'}
        onOpenChange={(v) => setOpenDialog(v ? 'invoice' : null)}
      />
      <SendEmailDialog orderPublicId={order.publicId} open={openDialog === 'email'} onOpenChange={(v) => setOpenDialog(v ? 'email' : null)} />
      <CloseOrderDialog order={order} open={openDialog === 'close'} onOpenChange={(v) => setOpenDialog(v ? 'close' : null)} />
      <CancelDialog orderPublicId={order.publicId} open={openDialog === 'cancel'} onOpenChange={(v) => setOpenDialog(v ? 'cancel' : null)} />
    </>
  );
}
