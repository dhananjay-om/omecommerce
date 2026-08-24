'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

/**
 * Thin styling/composition shell over the existing `Table` primitives —
 * NOT a TanStack-table rewrite, just the one place every list page's row
 * density/hover/empty-state convention lives, so restyling the ~24 real
 * list pages (admin UI revamp, Phase 2) is a mechanical import swap rather
 * than 24 bespoke edits. Column-driven, matching the mock's own
 * `dataTable(opts)` helper shape (`cols: [{key, label, align, render}]`).
 * Sorting/filtering/pagination stay page-owned (every real list page
 * already has its own — this only standardizes the table's own markup).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Optional — when set, clicking anywhere in the row navigates there
   *  (via router.push, not a real `<a>` — a column can still put its own
   *  `<Link>` in a cell for ctrl/cmd-click-to-open-in-new-tab if that
   *  matters for a given page). */
  rowHref?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        {emptyDescription ? <p className="text-sm text-muted-foreground">{emptyDescription}</p> : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className={cn(col.align === 'right' && 'text-right', col.align === 'center' && 'text-center', col.className)}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const cells = columns.map((col) => (
              <TableCell key={col.key} className={cn(col.align === 'right' && 'text-right', col.align === 'center' && 'text-center', col.className)}>
                {col.render(row, i)}
              </TableCell>
            ));
            if (rowHref) {
              const href = rowHref(row);
              return (
                <TableRow key={rowKey(row, i)} className="cursor-pointer" onClick={() => router.push(href)}>
                  {cells}
                </TableRow>
              );
            }
            return <TableRow key={rowKey(row, i)}>{cells}</TableRow>;
          })}
        </TableBody>
      </Table>
    </div>
  );
}
