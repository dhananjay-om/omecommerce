import { apiGet } from '@/lib/api-client';
import type { Coupon } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewCouponDialog } from './new-coupon-dialog';
import { EditCouponDialog } from './edit-coupon-dialog';
import { DeleteCouponDialog } from './delete-coupon-dialog';

function formatValue(c: Coupon): string {
  return c.discountType === 'PERCENTAGE' ? `${Number(c.value)}% off` : `${c.currency} ${c.value} off`;
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
            One code = one whole-cart discount. Customers apply a code in the cart or checkout.
          </p>
        </div>
        <NewCouponDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No coupons yet.
                </TableCell>
              </TableRow>
            ) : (
              coupons.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>{formatValue(c)}</TableCell>
                  <TableCell>{c.minSubtotal ? `${c.currency} ${c.minSubtotal}` : '—'}</TableCell>
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
                      <EditCouponDialog coupon={c} />
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
