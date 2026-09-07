'use client';

import Link from 'next/link';
import type { FulfillmentListItem } from '@/lib/types';
import { relativeDate } from '@/lib/relative-date';
import { DotBadge } from '@/components/dot-badge';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBadgeVariant } from '@/lib/status-badge';
import { EditTrackingDialog } from '../shipments/edit-tracking-dialog';

/** Same underlying Fulfillment rows Shipments shows — this view leads
 *  with delivery/SLA state (a "Delayed" flag alongside status) instead of
 *  carrier detail, reusing the exact same edit-tracking action (no second
 *  mutation for the same resource). */
export function DeliveryTable({ fulfillments }: { fulfillments: FulfillmentListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>ETA</TableHead>
            <TableHead>Carrier</TableHead>
            <TableHead>Shipped</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {fulfillments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No shipments found.
              </TableCell>
            </TableRow>
          ) : (
            fulfillments.map((f) => (
              <TableRow key={f.publicId}>
                <TableCell>
                  <Link href={`/orders/${f.orderPublicId}`} className="font-semibold hover:underline">
                    #{f.orderNumber}
                  </Link>
                  <div className="text-xs text-muted-foreground">{f.email}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <DotBadge variant={statusBadgeVariant(f.status)}>{f.status}</DotBadge>
                    {f.isDelayed ? <Badge variant="destructive">Delayed</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {f.estimatedDeliveryAt ? new Date(f.estimatedDeliveryAt).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>{f.carrier ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{f.shippedAt ? relativeDate(f.shippedAt) : '—'}</TableCell>
                <TableCell>
                  <EditTrackingDialog fulfillment={f} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
