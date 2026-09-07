import Link from 'next/link';
import type { RefundListItem } from '@/lib/types';
import { relativeDate } from '@/lib/relative-date';
import { formatPrice } from '@/lib/format-price';
import { DotBadge } from '@/components/dot-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBadgeVariant } from '@/lib/status-badge';

export function RefundsTable({ refunds }: { refunds: RefundListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Order</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Gateway</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {refunds.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No refunds found.
              </TableCell>
            </TableRow>
          ) : (
            refunds.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/orders/${r.orderPublicId}`} className="font-semibold hover:underline">
                    #{r.orderNumber}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell className="font-medium">{formatPrice(r.amount, r.currency)}</TableCell>
                <TableCell>{r.method}</TableCell>
                <TableCell className="text-muted-foreground">{r.gateway}</TableCell>
                <TableCell>
                  <DotBadge variant={statusBadgeVariant(r.status)}>{r.status}</DotBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">{relativeDate(r.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
