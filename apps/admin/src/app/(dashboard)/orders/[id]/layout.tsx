import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { OrderDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { NavTabs } from '@/components/nav-tabs';
import { Card, CardContent } from '@/components/ui/card';
import { OrderStepper } from '../order-stepper';
import { FulfillDialog } from '../fulfill-dialog';
import { RefundDialog } from '../refund-dialog';
import { CancelDialog } from '../cancel-dialog';
import { CreateInvoiceDialog } from '../create-invoice-dialog';
import { SendEmailDialog } from '../send-email-dialog';
import { CloseOrderDialog } from '../close-order-dialog';
import { MarkPaidDialog } from '../mark-paid-dialog';

/**
 * Shared chrome for every /orders/[id]/* tab (Information/Invoices/Shipments/
 * Emails/History) — order number + status badges + the action bar, plus a
 * horizontal `NavTabs` strip (admin UI revamp, Phase 2 — replaces the old
 * left-rail `OrderViewNav`, migrated first as the pattern-setter since this
 * is the smallest of the app's 3 tabbed detail views; Customers and Reports
 * follow the same shape). `getOrder`'s fetch is deduped by Next.js against
 * the identical call each child page also makes (same URL+options, same
 * request pass), so fetching the full order here too costs no extra network
 * round trip.
 */
export default async function OrderDetailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiGet<OrderDetail>(`/admin/v1/orders/${id}`);
  const cancellable = !['CANCELLED', 'COMPLETED', 'CLOSED'].includes(order.status);

  return (
    <div>
      <Link href="/orders" className="text-sm text-muted-foreground hover:underline">
        ← Back to Orders
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">#{order.orderNumber}</h1>
            <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
            <Badge variant={statusBadgeVariant(order.financialStatus)}>{order.financialStatus}</Badge>
            <Badge variant={statusBadgeVariant(order.fulfillmentStatus)}>{order.fulfillmentStatus}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {new Date(order.placedAt).toLocaleString('en-US')}
            {order.closedAt ? ` · Closed ${new Date(order.closedAt).toLocaleString('en-US')}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MarkPaidDialog order={order} />
          <FulfillDialog orderPublicId={order.publicId} lines={order.lines} />
          <RefundDialog orderPublicId={order.publicId} lines={order.lines} />
          <CreateInvoiceDialog orderPublicId={order.publicId} lines={order.lines} invoices={order.invoices} />
          <SendEmailDialog orderPublicId={order.publicId} />
          <CloseOrderDialog order={order} />
          {cancellable ? <CancelDialog orderPublicId={order.publicId} /> : null}
        </div>
      </div>

      {order.status !== 'CANCELLED' ? (
        <Card className="mt-4">
          <CardContent className="py-4">
            <OrderStepper order={order} />
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6">
        <NavTabs
          items={[
            { href: `/orders/${order.publicId}`, label: 'Information' },
            { href: `/orders/${order.publicId}/invoices`, label: 'Invoices' },
            { href: `/orders/${order.publicId}/shipments`, label: 'Shipments' },
            { href: `/orders/${order.publicId}/emails`, label: 'Emails' },
            { href: `/orders/${order.publicId}/history`, label: 'Comments History' },
          ]}
        />
        <div className="mt-6 min-w-0">{children}</div>
      </div>
    </div>
  );
}
