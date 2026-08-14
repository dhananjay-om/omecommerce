import { apiGet } from '@/lib/api-client';
import type { OrderDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddNoteForm } from '../add-note-form';

function sum(values: string[]): number {
  return values.reduce((acc, v) => acc + Number(v), 0);
}

function invoicedQty(order: OrderDetail, sku: string): number {
  return sum(order.invoices.flatMap((inv) => inv.lines).filter((l) => l.sku === sku).map((l) => String(l.qty)));
}

function InfoRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b px-3 py-2.5 text-sm odd:bg-muted/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}

function AddressBlock({ label, address }: { label: string; address: OrderDetail['addresses'][number] | undefined }) {
  return (
    <div>
      <div className="text-sm font-semibold">{label}</div>
      {address ? (
        <div className="mt-2 text-sm leading-relaxed">
          <div className="font-medium">{address.name}</div>
          {address.company ? <div>{address.company}</div> : null}
          <div>{address.line1}</div>
          {address.line2 ? <div>{address.line2}</div> : null}
          <div>
            {address.city}, {address.region ?? ''} {address.postalCode}
          </div>
          <div>{address.country}</div>
          {address.phone ? <div>T: {address.phone}</div> : null}
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">—</div>
      )}
    </div>
  );
}

export default async function OrderInformationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiGet<OrderDetail>(`/admin/v1/orders/${id}`);
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  const customerName = billing?.name ?? order.email;
  const latestPayment = order.payments[order.payments.length - 1];

  const paidTotal = sum(order.payments.filter((p) => p.type === 'CAPTURE' && p.status === 'SUCCEEDED').map((p) => p.amount));
  const refundedTotal = sum(order.payments.filter((p) => p.type === 'REFUND' && p.status === 'SUCCEEDED').map((p) => p.amount));
  const remaining = Number(order.grandTotal) - paidTotal + refundedTotal;

  return (
    <div className="space-y-6">
      <SectionCard title="Order & Account Information">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-lg border">
            <InfoRow label="Order Date" value={new Date(order.placedAt).toLocaleString('en-US')} />
            <InfoRow label="Order Status" value={order.status} />
            {order.customerIp ? <InfoRow label="Placed from IP" value={order.customerIp} /> : null}
          </div>
          <div className="overflow-hidden rounded-lg border">
            <InfoRow label="Customer Name" value={customerName} />
            <InfoRow label="Email" value={order.email} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Address Information">
        <div className="grid gap-6 sm:grid-cols-2">
          <AddressBlock label="Billing Address" address={billing} />
          <AddressBlock label="Shipping Address" address={shipping} />
        </div>
      </SectionCard>

      <SectionCard title="Payment & Shipping Method">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-sm font-semibold">Payment Information</div>
            <div className="mt-2 text-sm">
              {latestPayment ? (
                <>
                  <div>{latestPayment.method}</div>
                  <div className="text-muted-foreground">The order was placed using {order.currency}.</div>
                </>
              ) : (
                <div className="text-muted-foreground">No payment recorded yet.</div>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold">Shipping & Handling Information</div>
            <div className="mt-2 text-sm">
              <div>{order.shippingMethodCode ?? '—'}</div>
              <div className="text-muted-foreground">
                {order.currency} {order.shippingTotal}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Items Ordered">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Invoiced</TableHead>
                <TableHead>Shipped</TableHead>
                <TableHead>Refunded</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((line) => (
                <TableRow key={line.sku}>
                  <TableCell>
                    <div className="font-medium">{line.name}</div>
                    <div className="text-xs text-muted-foreground">SKU: {line.sku}</div>
                  </TableCell>
                  <TableCell>
                    {order.currency} {line.unitPrice}
                  </TableCell>
                  <TableCell>{line.qty}</TableCell>
                  <TableCell>{invoicedQty(order, line.sku)}</TableCell>
                  <TableCell>{line.fulfilledQty}</TableCell>
                  <TableCell>{line.refundedQty}</TableCell>
                  <TableCell>
                    {order.currency} {line.discountAmount}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {order.currency} {line.rowTotal}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <SectionCard title="Notes for this Order">
          <div className="space-y-4">
            <AddNoteForm orderPublicId={order.publicId} />
            {order.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {order.notes.map((n) => (
                  <li key={n.id} className="border-b pb-3 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={n.type === 'INTERNAL' ? 'secondary' : 'outline'}>{n.type}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString('en-US')}</span>
                    </div>
                    <p className="mt-1">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Order Totals">
          <div className="overflow-hidden rounded-lg border">
            <InfoRow label="Subtotal" value={`${order.currency} ${order.subtotal}`} />
            <InfoRow label={order.couponCode ? `Discount (${order.couponCode})` : 'Discount'} value={`-${order.currency} ${order.discountTotal}`} />
            <InfoRow label="Shipping & Handling" value={`${order.currency} ${order.shippingTotal}`} />
            <InfoRow label="Tax" value={`${order.currency} ${order.taxTotal}`} />
            <InfoRow label={<span className="font-semibold">Grand Total</span>} value={<span className="font-bold">{order.currency} {order.grandTotal}</span>} />
            <InfoRow label="Total Paid" value={`${order.currency} ${paidTotal.toFixed(4)}`} />
            <InfoRow label="Total Refunded" value={`${order.currency} ${refundedTotal.toFixed(4)}`} />
            <InfoRow label={<span className="font-semibold">Total Due</span>} value={<span className="font-bold">{order.currency} {remaining.toFixed(4)}</span>} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
