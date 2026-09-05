'use client';

import Link from 'next/link';
import type { FulfillmentListItem } from '@/lib/types';
import { relativeDate } from '@/lib/relative-date';
import { DotBadge } from '@/components/dot-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBadgeVariant } from '@/lib/status-badge';
import { EditTrackingDialog } from './edit-tracking-dialog';

export function ShipmentsTable({ fulfillments }: { fulfillments: FulfillmentListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Carrier</TableHead>
            <TableHead>Tracking</TableHead>
            <TableHead>ETA</TableHead>
            <TableHead>Shipped</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {fulfillments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                  <DotBadge variant={statusBadgeVariant(f.status)}>{f.status}</DotBadge>
                </TableCell>
                <TableCell>{f.carrier ?? '—'}</TableCell>
                <TableCell>
                  {f.trackingNumber ? (
                    f.carrierTrackingUrl ? (
                      <a href={f.carrierTrackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {f.trackingNumber}
                      </a>
                    ) : (
                      f.trackingNumber
                    )
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {f.estimatedDeliveryAt ? new Date(f.estimatedDeliveryAt).toLocaleDateString() : '—'}
                </TableCell>
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
