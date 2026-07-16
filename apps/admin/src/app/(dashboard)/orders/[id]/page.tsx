import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { OrderDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FulfillDialog } from '../fulfill-dialog';
import { RefundDialog } from '../refund-dialog';
import { CancelDialog } from '../cancel-dialog';
import { statusBadgeVariant } from '@/lib/status-badge';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiGet<OrderDetail>(`/admin/v1/orders/${id}`);
  const cancellable = order.status !== 'CANCELLED' && order.status !== 'COMPLETED';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/orders" className="text-sm text-muted-foreground hover:underline">
          ← Back to Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Order #{order.orderNumber}</h1>
          <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
          <Badge variant={statusBadgeVariant(order.financialStatus)}>{order.financialStatus}</Badge>
          <Badge variant={statusBadgeVariant(order.fulfillmentStatus)}>{order.fulfillmentStatus}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{order.email}</p>
      </div>

      <div className="flex gap-2">
        <FulfillDialog orderPublicId={order.publicId} lines={order.lines} />
        <RefundDialog orderPublicId={order.publicId} lines={order.lines} />
        {cancellable ? <CancelDialog orderPublicId={order.publicId} /> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Row Total</TableHead>
                <TableHead>Fulfilled</TableHead>
                <TableHead>Refunded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((line) => (
                <TableRow key={line.sku}>
                  <TableCell className="font-medium">{line.sku}</TableCell>
                  <TableCell>{line.name}</TableCell>
                  <TableCell>{line.qty}</TableCell>
                  <TableCell>{line.unitPrice}</TableCell>
                  <TableCell>{line.rowTotal}</TableCell>
                  <TableCell>{line.fulfilledQty}</TableCell>
                  <TableCell>{line.refundedQty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Subtotal</div>
            <div className="font-medium">
              {order.currency} {order.subtotal}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Tax</div>
            <div className="font-medium">
              {order.currency} {order.taxTotal}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Shipping</div>
            <div className="font-medium">
              {order.currency} {order.shippingTotal}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Grand Total</div>
            <div className="font-medium">
              {order.currency} {order.grandTotal}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
