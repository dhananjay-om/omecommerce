import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Coupon } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DeleteCouponDialog } from './delete-coupon-dialog';

function formatValue(c: Coupon): string {
  // currency is only ever null for a PERCENTAGE coupon (not needed there) —
  // a FIXED_AMOUNT coupon always has one, enforced at creation.
  return c.discountType === 'PERCENTAGE' ? `${Number(c.value)}% off` : `${formatPrice(c.value, c.currency!)} off`;
}

function formatWindow(c: Coupon): string {
  if (!c.startsAt && !c.endsAt) return 'Always';
  const start = c.startsAt ? new Date(c.startsAt).toLocaleDateString() : '…';
  const end = c.endsAt ? new Date(c.endsAt).toLocaleDateString() : '…';
  return `${start} – ${end}`;
}

export default async function CouponsPage() {
  const coupons = await apiGet<Coupon[]>('/admin/v1/coupons');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discount codes for the whole cart or specific matching items — manually entered or applied automatically.
          </p>
        </div>
        <Link href="/coupons/new" className={cn(buttonVariants())}>
          New Coupon
        </Link>
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Min Subtotal</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                <TableRow key={c.code}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>{formatValue(c)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline">{c.targetType === 'ITEM' ? `Items (${c.conditions.length})` : 'Whole Cart'}</Badge>
                      {c.isAutoApply ? <Badge variant="secondary">Auto-Apply</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>{c.minSubtotal ? formatPrice(c.minSubtotal, c.currency!) : '—'}</TableCell>
                  <TableCell>
                    {c.usageCount} / {c.usageLimit ?? '∞'}
                    {c.usageLimitPerCustomer ? ` (max ${c.usageLimitPerCustomer}/customer)` : ''}
                  </TableCell>
                  <TableCell>{formatWindow(c)}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? 'success' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/coupons/${c.code}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                        Edit
                      </Link>
                      <DeleteCouponDialog code={c.code} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
