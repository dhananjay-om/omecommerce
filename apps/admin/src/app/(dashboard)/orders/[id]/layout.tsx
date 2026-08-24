import { apiGet } from '@/lib/api-client';
import type { OrderDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { NavTabs } from '@/components/nav-tabs';
import { Card, CardContent } from '@/components/ui/card';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { OrderStepper } from '../order-stepper';
import { FulfillDialog } from '../fulfill-dialog';
import { RefundDialog } from '../refund-dialog';
import { MarkPaidDialog } from '../mark-paid-dialog';
import { OrderActionsMenu } from '../order-actions-menu';

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
/** "24 Aug 2026, 10:28 AM" — matches the mock's compact placed-date format
 *  (no seconds) instead of the noisier full `toLocaleString()` output. */
function formatPlacedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function OrderDetailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiGet<OrderDetail>(`/admin/v1/orders/${id}`);

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/orders' }, { label: 'Orders', href: '/orders' }, { label: `#${order.orderNumber}` }]} />

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {/* The mock's `.page-title` is 1.32rem/800 everywhere (list AND
                detail pages) — much smaller than a typical `text-3xl` (30px)
                h1; matched exactly here instead of guessing at a Tailwind
                step size. */}
            <h1 className="text-[1.32rem] font-extrabold tracking-tight">Order #{order.orderNumber}</h1>
            <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
          </div>
          {/* Financial/fulfillment status folded into plain text here instead
              of 2 more stacked badges — the mock only carries one status
              dimension; this app tracks 3, so the other 2 ride along as
              text next to the placed date rather than competing for the
              same visual weight as the primary status badge. */}
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatPlacedAt(order.placedAt)} · {order.financialStatus} · {order.fulfillmentStatus}
            {order.closedAt ? ` · Closed ${formatPlacedAt(order.closedAt)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MarkPaidDialog order={order} />
          <FulfillDialog orderPublicId={order.publicId} lines={order.lines} />
          <RefundDialog orderPublicId={order.publicId} lines={order.lines} />
          <OrderActionsMenu order={order} />
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
