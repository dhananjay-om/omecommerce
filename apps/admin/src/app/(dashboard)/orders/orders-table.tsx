'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { OrderListItem } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { relativeDate } from '@/lib/relative-date';
import { DotBadge } from '@/components/dot-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { statusBadgeVariant } from '@/lib/status-badge';
import { bulkDeleteOrders } from './actions';
import { DeleteOrderDialog, deleteEligible } from './delete-order-dialog';

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
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderListItem | null>(null);

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.publicId));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.publicId)));
  }

  function toggleOne(publicId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  }

  function applyBulkDelete() {
    setBulkError(null);
    startTransition(async () => {
      const result = await bulkDeleteOrders(Array.from(selected));
      setSelected(new Set());
      if (result.errors.length > 0) {
        setBulkError(`Deleted ${result.deletedCount}, ${result.errors.length} skipped: ${result.errors.join('; ')}`);
      }
      router.refresh();
    });
  }

  return (
    <div>
      {/* Only "Delete" so far — Export/Fulfill-in-bulk aren't real backend
          capabilities yet, so they're not offered here rather than faked. */}
      {selected.size > 0 ? (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          <span>
            {selected.size} order{selected.size === 1 ? '' : 's'} selected
          </span>
          <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={applyBulkDelete}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
          {bulkError ? <span className="font-normal text-destructive">{bulkError}</span> : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-6">
                <input type="checkbox" className="size-4" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Order #</TableHead>
              <SortableHeader label="Customer" sortKey="customerName" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
              <SortableHeader label="Date" sortKey="createdAt" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
              <SortableHeader label="Total" sortKey="grandTotal" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.publicId} className="cursor-pointer" onClick={() => router.push(`/orders/${o.publicId}`)}>
                  <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="size-4" checked={selected.has(o.publicId)} onChange={() => toggleOne(o.publicId)} aria-label={`Select order ${o.orderNumber}`} />
                  </TableCell>
                  <TableCell className="font-semibold">#{o.orderNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{o.customerName}</div>
                    <div className="text-xs text-muted-foreground">{o.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{relativeDate(o.createdAt)}</TableCell>
                  <TableCell className="font-medium">{formatPrice(o.grandTotal, o.currency)}</TableCell>
                  <TableCell>
                    <DotBadge variant={statusBadgeVariant(o.financialStatus)}>{o.financialStatus}</DotBadge>
                  </TableCell>
                  <TableCell>
                    <DotBadge variant={statusBadgeVariant(o.status)}>{o.status}</DotBadge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
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
                          {deleteEligible(o.status) ? (
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(o)}>
                              Delete Order
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* One shared, externally-controlled dialog instance for every row's
          "Delete Order" menu item — same pattern as the Products list. */}
      <DeleteOrderDialog
        orderPublicId={deleteTarget?.publicId ?? ''}
        orderNumber={deleteTarget?.orderNumber ?? ''}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
