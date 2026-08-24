'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { Coupon } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { DotBadge } from '@/components/dot-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DeleteCouponDialog } from './delete-coupon-dialog';

function formatValue(c: Coupon): string {
  // currency is only ever null for a PERCENTAGE coupon (not needed there) —
  // a FIXED_AMOUNT coupon always has one, enforced at creation.
  return c.discountType === 'PERCENTAGE' ? `${Number(c.value)}% off` : `${formatPrice(c.value, c.currency!)} off`;
}

function formatWindow(c: Coupon): string {
  if (!c.startsAt && !c.endsAt) return 'Always';
  // Explicit locale — an implicit toLocaleDateString() picks up whatever
  // locale the runtime defaults to, which can differ between server and
  // browser (e.g. "14/8/2026" vs "14/08/2026") and throws a hydration
  // mismatch once this renders inside a client component (found live
  // while restyling this table — pre-existing, not new to this pass).
  const start = c.startsAt ? new Date(c.startsAt).toLocaleDateString('en-US') : '…';
  const end = c.endsAt ? new Date(c.endsAt).toLocaleDateString('en-US') : '…';
  return `${start} – ${end}`;
}

export function CouponsTable({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-6">Code</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Applies To</TableHead>
            <TableHead>Min Subtotal</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-14 pr-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No coupons yet.
              </TableCell>
            </TableRow>
          ) : (
            coupons.map((c) => (
              <TableRow key={c.code} className="cursor-pointer" onClick={() => router.push(`/coupons/${c.code}/edit`)}>
                <TableCell className="pl-6 font-mono font-medium">{c.code}</TableCell>
                <TableCell>{formatValue(c)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline">{c.targetType === 'ITEM' ? `Items (${c.conditions.length})` : 'Whole Cart'}</Badge>
                    {c.isAutoApply ? <Badge variant="secondary">Auto-Apply</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.minSubtotal ? formatPrice(c.minSubtotal, c.currency!) : '—'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.usageCount} / {c.usageLimit ?? '∞'}
                  {c.usageLimitPerCustomer ? ` (max ${c.usageLimitPerCustomer}/customer)` : ''}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatWindow(c)}</TableCell>
                <TableCell>
                  <DotBadge variant={c.isActive ? 'success' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</DotBadge>
                </TableCell>
                <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions for {c.code}</span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/coupons/${c.code}/edit`)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(c)}>
                          Delete
                        </DropdownMenuItem>
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

      <DeleteCouponDialog
        code={deleteTarget?.code ?? ''}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
