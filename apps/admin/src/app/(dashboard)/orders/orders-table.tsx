'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import type { OrderListItem } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { statusBadgeVariant } from '@/lib/status-badge';

export type SortKey = 'createdAt' | 'grandTotal' | 'customerName';

function SortableHeader({
  label,
  sortKey,
  sortLinks,
  activeSortBy,
  activeSortDir,
}: {
  label: string;
  sortKey: SortKey;
  sortLinks: Record<SortKey, string>;
  activeSortBy: string;
  activeSortDir: string;
}) {
  return (
    <TableHead>
      <Link href={sortLinks[sortKey]} className="flex items-center gap-1 hover:underline">
        {label}
        {activeSortBy === sortKey ? <span>{activeSortDir === 'asc' ? '▲' : '▼'}</span> : null}
      </Link>
    </TableHead>
  );
}

export function OrdersTable({
  orders,
  sortLinks,
  activeSortBy,
  activeSortDir,
}: {
  orders: OrderListItem[];
  sortLinks: Record<SortKey, string>;
  activeSortBy: string;
  activeSortDir: string;
}) {
  const router = useRouter();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Email</TableHead>
            <SortableHeader label="Customer" sortKey="customerName" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
            <TableHead>Payment Method</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Financial</TableHead>
            <TableHead>Fulfillment</TableHead>
            <SortableHeader label="Grand Total" sortKey="grandTotal" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
            <SortableHeader label="Created" sortKey="createdAt" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No orders found.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((o) => (
              <TableRow key={o.publicId}>
                <TableCell className="font-medium">
                  <Link href={`/orders/${o.publicId}`} className="hover:underline">
                    {o.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>{o.email}</TableCell>
                <TableCell>{o.customerName}</TableCell>
                <TableCell>{o.paymentMethod ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(o.status)}>{o.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(o.financialStatus)}>{o.financialStatus}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(o.fulfillmentStatus)}>{o.fulfillmentStatus}</Badge>
                </TableCell>
                <TableCell>
                  {o.currency} {o.grandTotal}
                </TableCell>
                <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Actions for order {o.orderNumber}</span>
                        </Button>
                      }
                    />
                    {/* Invoice/Shipment/Download-Invoice items land here once plan/15 Phases 15.7/15.8 ship dedicated destinations for them — until then this menu only links to real, working actions. */}
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/orders/${o.publicId}`)}>View Order</DropdownMenuItem>
                      {o.status !== 'CANCELLED' && o.status !== 'CLOSED' ? (
                        <DropdownMenuItem variant="destructive" onClick={() => router.push(`/orders/${o.publicId}`)}>
                          Cancel Order
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
