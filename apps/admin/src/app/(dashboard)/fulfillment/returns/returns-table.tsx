import Link from 'next/link';
import type { ReturnListItem } from '@/lib/types';
import { relativeDate } from '@/lib/relative-date';
import { DotBadge } from '@/components/dot-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBadgeVariant } from '@/lib/status-badge';
import { ReturnRowActions } from './return-row-actions';

export function ReturnsTable({ returns }: { returns: ReturnListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Order</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Lines</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead className="w-56" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {returns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No returns found.
              </TableCell>
            </TableRow>
          ) : (
            returns.map((r) => (
              <TableRow key={r.publicId}>
                <TableCell>
                  <Link href={`/orders/${r.orderPublicId}`} className="font-semibold hover:underline">
                    #{r.orderNumber}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell className="max-w-[240px] truncate text-muted-foreground" title={r.reason}>
                  {r.reason}
                </TableCell>
                <TableCell>{r.lineCount}</TableCell>
                <TableCell>
                  <DotBadge variant={statusBadgeVariant(r.status)}>{r.status}</DotBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">{relativeDate(r.createdAt)}</TableCell>
                <TableCell>
                  <ReturnRowActions publicId={r.publicId} status={r.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
