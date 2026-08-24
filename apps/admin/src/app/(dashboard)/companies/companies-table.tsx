'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { CompanyListItem } from '@/lib/types';
import { relativeDate } from '@/lib/relative-date';
import { DotBadge } from '@/components/dot-badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CompaniesTable({ companies }: { companies: CompanyListItem[] }) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-6">Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-6">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No companies found.
              </TableCell>
            </TableRow>
          ) : (
            companies.map((c) => (
              <TableRow key={c.publicId} className="cursor-pointer" onClick={() => router.push(`/companies/${c.publicId}`)}>
                <TableCell className="pl-6 font-mono font-medium">{c.code}</TableCell>
                <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                <TableCell>
                  <DotBadge variant={statusBadgeVariant(c.status)}>{c.status}</DotBadge>
                </TableCell>
                <TableCell className="pr-6 text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    {relativeDate(c.createdAt)}
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
