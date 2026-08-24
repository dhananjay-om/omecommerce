'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { OrderListItem } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { statusBadgeVariant } from '@/lib/status-badge';
import { cn } from '@/lib/utils';

export type SortKey = 'createdAt' | 'grandTotal' | 'customerName';

/** "Today" / "3 days ago" / "1w ago" — matches the mock's relative Date
 *  column exactly, instead of a fixed-format absolute date. */
function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString('en-US');
}

/** A status pill with a leading colored dot — matches the mock's `.badge`
 *  exactly (existing `Badge` variants already give the tinted bg + colored
 *  text; the dot is the one piece this table adds locally). */
function DotBadge({ variant, children }: { variant: VariantProps<typeof badgeVariants>['variant']; children: React.ReactNode }) {
  const dotColor: Record<string, string> = {
    success: 'bg-status-good',
    warning: 'bg-status-warning',
    destructive: 'bg-status-critical',
    secondary: 'bg-muted-foreground',
    outline: 'bg-muted-foreground',
    default: 'bg-primary',
  };
  return (
    <Badge variant={variant}>
      <span className={cn('size-1.5 rounded-full', dotColor[variant ?? 'default'])} />
      {children}
    </Badge>
  );
}

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
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
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
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No orders found.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((o) => (
              <TableRow key={o.publicId} className="cursor-pointer" onClick={() => router.push(`/orders/${o.publicId}`)}>
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
  );
}
