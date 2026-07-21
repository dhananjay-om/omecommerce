import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { OrderDetail, OrderHistoryEntry } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FulfillDialog } from '../fulfill-dialog';
import { RefundDialog } from '../refund-dialog';
import { CancelDialog } from '../cancel-dialog';
import { AddNoteForm } from '../add-note-form';
import { CreateInvoiceDialog } from '../create-invoice-dialog';
import { InvoicesCard } from '../invoices-card';
import { statusBadgeVariant } from '@/lib/status-badge';

function sum(values: string[]): number {
  return values.reduce((acc, v) => acc + Number(v), 0);
}

function invoicedQty(order: OrderDetail, sku: string): number {
  return sum(order.invoices.flatMap((inv) => inv.lines).filter((l) => l.sku === sku).map((l) => String(l.qty)));
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, history] = await Promise.all([
    apiGet<OrderDetail>(`/admin/v1/orders/${id}`),
    apiGet<OrderHistoryEntry[]>(`/admin/v1/orders/${id}/history`),
  ]);
  const cancellable = !['CANCELLED', 'COMPLETED', 'CLOSED'].includes(order.status);
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  const customerName = billing?.name ?? order.email;

  const paidTotal = sum(order.payments.filter((p) => p.type === 'CAPTURE' && p.status === 'SUCCEEDED').map((p) => p.amount));
  const refundedTotal = sum(order.payments.filter((p) => p.type === 'REFUND' && p.status === 'SUCCEEDED').map((p) => p.amount));
  const remaining = Number(order.grandTotal) - paidTotal + refundedTotal;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/orders" className="text-sm text-muted-foreground hover:underline">
          ← Back to Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Order #{order.orderNumber}</h1>
          <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
          <Badge variant={statusBadgeVariant(order.financialStatus)}>{order.financialStatus}</Badge>
          <Badge variant={statusBadgeVariant(order.fulfillmentStatus)}>{order.fulfillmentStatus}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Placed {new Date(order.placedAt).toLocaleString()}
          {order.closedAt ? ` · Closed ${new Date(order.closedAt).toLocaleString()}` : ''}
          {order.shippingMethodCode ? ` · Ships via ${order.shippingMethodCode}` : ''}
        </p>
      </div>

      <div className="flex gap-2">
        <FulfillDialog orderPublicId={order.publicId} lines={order.lines} />
        <RefundDialog orderPublicId={order.publicId} lines={order.lines} />
        <CreateInvoiceDialog orderPublicId={order.publicId} lines={order.lines} invoices={order.invoices} />
        {cancellable ? <CancelDialog orderPublicId={order.publicId} /> : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">{customerName}</div>
            <div className="text-muted-foreground">{order.email}</div>
            {order.customerIp ? <div className="text-muted-foreground">IP: {order.customerIp}</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <AddressBlock label="Billing" address={billing} />
            <AddressBlock label="Shipping" address={shipping} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Row Total</TableHead>
                <TableHead>Invoiced</TableHead>
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
                  <TableCell>{line.discountAmount}</TableCell>
                  <TableCell>{line.rowTotal}</TableCell>
                  <TableCell>{invoicedQty(order, line.sku)}</TableCell>
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
          <CardTitle>Price Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <SummaryItem label="Subtotal" value={order.subtotal} currency={order.currency} />
          <SummaryItem label="Discount" value={order.discountTotal} currency={order.currency} />
          <SummaryItem label="Shipping" value={order.shippingTotal} currency={order.currency} />
          <SummaryItem label="Tax" value={order.taxTotal} currency={order.currency} />
          <SummaryItem label="Grand Total" value={order.grandTotal} currency={order.currency} emphasize />
          <SummaryItem label="Paid" value={paidTotal.toFixed(4)} currency={order.currency} />
          <SummaryItem label="Refunded" value={refundedTotal.toFixed(4)} currency={order.currency} />
          <SummaryItem label="Remaining" value={remaining.toFixed(4)} currency={order.currency} emphasize />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoicesCard orderPublicId={order.publicId} invoices={order.invoices} currency={order.currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.fulfillments.every((f) => !f.hasPackingSlip) ? (
            <p className="text-muted-foreground">No packing slips yet.</p>
          ) : (
            <ul className="space-y-1">
              {order.fulfillments
                .filter((f) => f.hasPackingSlip)
                .map((f) => (
                  <li key={f.publicId}>
                    <a
                      href={`/api/orders/${order.publicId}/shipment/${f.publicId}/packing-slip`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Packing Slip — Shipment {f.publicId.slice(0, 8)} (PDF)
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{h.message ?? h.eventType}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.actorType === 'ADMIN' && h.actorName ? h.actorName : h.actorType}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {order.notes.map((n) => (
                <li key={n.id} className="border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={n.type === 'INTERNAL' ? 'secondary' : 'outline'}>{n.type}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
          <AddNoteForm orderPublicId={order.publicId} />
        </CardContent>
      </Card>
    </div>
  );
}

function AddressBlock({ label, address }: { label: string; address: OrderDetail['addresses'][number] | undefined }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      {address ? (
        <div className="font-medium">
          <div>{address.name}</div>
          {address.company ? <div>{address.company}</div> : null}
          <div>{address.line1}</div>
          {address.line2 ? <div>{address.line2}</div> : null}
          <div>
            {address.city}, {address.region ?? ''} {address.postalCode}
          </div>
          <div>{address.country}</div>
          {address.phone ? <div>{address.phone}</div> : null}
        </div>
      ) : (
        <div className="text-muted-foreground">—</div>
      )}
    </div>
  );
}

function SummaryItem({ label, value, currency, emphasize }: { label: string; value: string; currency: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={emphasize ? 'font-semibold' : 'font-medium'}>
        {currency} {value}
      </div>
    </div>
  );
}
