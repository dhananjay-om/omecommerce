'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { GiftCardListItem } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { relativeDate } from '@/lib/relative-date';
import { DotBadge } from '@/components/dot-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBadgeVariant } from '@/lib/status-badge';

export function GiftCardsTable({ giftCards }: { giftCards: GiftCardListItem[] }) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-6">Code</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead className="text-right">Initial</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="pr-6">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {giftCards.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No gift cards found.
              </TableCell>
            </TableRow>
          ) : (
            giftCards.map((c) => (
              <TableRow key={c.publicId} className="cursor-pointer" onClick={() => router.push(`/gift-cards/${c.publicId}`)}>
                <TableCell className="pl-6 font-mono font-medium">•••• {c.codeLast4}</TableCell>
                <TableCell className="text-muted-foreground">{c.recipientEmail ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{c.kind}</TableCell>
                <TableCell className="text-right">{formatPrice(c.initialAmount, c.currency)}</TableCell>
                <TableCell className="text-right font-semibold">{formatPrice(c.balance, c.currency)}</TableCell>
                <TableCell>
                  <DotBadge variant={statusBadgeVariant(c.status)}>{c.status}</DotBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-US') : '—'}</TableCell>
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
