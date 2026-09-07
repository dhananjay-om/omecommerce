'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { CustomerListItem } from '@/lib/types';
import { relativeDate } from '@/lib/relative-date';
import { DotBadge } from '@/components/dot-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DeleteCustomerDialog } from './delete-customer-dialog';
import { bulkDeleteCustomers } from './actions';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function CustomersTable({ customers }: { customers: CustomerListItem[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);

  const allSelected = customers.length > 0 && customers.every((c) => selected.has(c.publicId));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(customers.map((c) => c.publicId)));
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
      const result = await bulkDeleteCustomers(Array.from(selected));
      setSelected(new Set());
      if (result.errors.length > 0) {
        setBulkError(`Deleted ${result.deletedCount}, ${result.errors.length} skipped: ${result.errors.join('; ')}`);
      }
      router.refresh();
    });
  }

  return (
    <div>
      {selected.size > 0 ? (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          <span>
            {selected.size} customer{selected.size === 1 ? '' : 's'} selected
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-14 pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
                return (
                  <TableRow key={c.publicId} className="cursor-pointer" onClick={() => router.push(`/customers/${c.publicId}`)}>
                    <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="size-4" checked={selected.has(c.publicId)} onChange={() => toggleOne(c.publicId)} aria-label={`Select ${c.email}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {initials(name)}
                        </div>
                        <span className="font-medium text-foreground">{name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell>
                      <DotBadge variant={c.isActive ? 'success' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</DotBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{relativeDate(c.createdAt)}</TableCell>
                    <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions for {c.email}</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/customers/${c.publicId}`)}>Open</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(c)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DeleteCustomerDialog
        publicId={deleteTarget?.publicId ?? ''}
        email={deleteTarget?.email ?? ''}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
