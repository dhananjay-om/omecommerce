import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { OrderDetail, OrderPayment } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AddNoteForm } from '../add-note-form';

function sum(values: string[]): number {
  return values.reduce((acc, v) => acc + Number(v), 0);
}

/** Raw gateway/method strings the backend actually sends (checkout-tender.test.ts, complete-checkout.usecase.ts) — shown to merchants, so plain-English beats the raw enum, same "never show raw enum names" convention the storefront uses for customers. */
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  test_card: 'Card',
  wallet: 'Wallet',
  giftcard: 'Gift Card',
  credit_terms: 'Credit Terms',
  original: 'Original Payment Method',
  COD: 'Cash on Delivery',
};

function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method] ?? method;
}

function invoicedQty(order: OrderDetail, sku: string): number {
  return sum(
    order.invoices
      .flatMap((inv) => inv.lines)
      .filter((l) => l.sku === sku)
      .map((l) => String(l.qty)),
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Right-sidebar card — matches the mock's narrower `1fr` column card shape
 *  exactly (compact header, no extra top padding on the body). */
function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 text-sm">{children}</CardContent>
    </Card>
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

function AddressLines({ address }: { address: OrderDetail['addresses'][number] | undefined }) {
  if (!address) return <p className="text-muted-foreground">No address on file.</p>;
  return (
    <div className="leading-relaxed">
      <div className="font-medium text-foreground">{address.name}</div>
      {address.company ? <div>{address.company}</div> : null}
      <div>{address.line1}</div>
      {address.line2 ? <div>{address.line2}</div> : null}
      <div>
        {address.city}, {address.region ?? ''} {address.postalCode}
      </div>
      <div>{address.country}</div>
      {address.phone ? <div>T: {address.phone}</div> : null}
      {address.gstin ? <div className="mt-1 text-xs text-muted-foreground">GSTIN: {address.gstin}</div> : null}
    </div>
  );
}

export default async function OrderInformationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await apiGet<OrderDetail>(`/admin/v1/orders/${id}`);
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  const customerName = billing?.name ?? order.email;

  const paidTotal = sum(
    order.payments
      .filter((p) => p.type === 'CAPTURE' && p.status === 'SUCCEEDED')
      .map((p) => p.amount),
  );
  const refundedTotal = sum(
    order.payments
      .filter((p) => p.type === 'REFUND' && p.status === 'SUCCEEDED')
      .map((p) => p.amount),
  );
  const remaining = Number(order.grandTotal) - paidTotal + refundedTotal;
  const latestPayment = order.payments[order.payments.length - 1];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      {/* Left — order details (items, fulfillment, account info) */}
      <div className="space-y-6">
        <SectionCard title={`Items (${order.lines.length})`}>
          <div className="-mx-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((line) => {
                  const invoiced = invoicedQty(order, line.sku);
                  // Compact sub-line instead of 3 dedicated columns (Invoiced/
                  // Shipped/Refunded) the mock doesn't have at all — only shown
                  // once fulfillment activity actually exists, so a freshly
                  // placed order's table matches the mock's clean 6-column
                  // look exactly instead of always carrying 3 all-zero columns.
                  const fulfillmentBits = [
                    invoiced > 0 ? `${invoiced} invoiced` : null,
                    line.fulfilledQty > 0 ? `${line.fulfilledQty} shipped` : null,
                    line.refundedQty > 0 ? `${line.refundedQty} refunded` : null,
                  ].filter(Boolean);
                  return (
                    <TableRow key={line.sku}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                            {initials(line.name)}
                          </div>
                          <div>
                            <div className="font-medium">{line.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {line.sku}
                              {line.hsnCode ? ` · HSN ${line.hsnCode}` : ''}
                            </div>
                            {fulfillmentBits.length > 0 ? <div className="mt-0.5 text-xs text-muted-foreground">{fulfillmentBits.join(' · ')}</div> : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{line.qty}</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-2">
                          {line.mrp && Number(line.mrp) > Number(line.unitPrice) ? (
                            <span className="text-xs text-muted-foreground line-through">{formatPrice(line.mrp, order.currency)}</span>
                          ) : null}
                          {formatPrice(line.unitPrice, order.currency)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{line.discountAmount !== '0.0000' ? `-${formatPrice(line.discountAmount, order.currency)}` : '—'}</TableCell>
                      <TableCell className="text-right">{formatPrice(line.taxAmount, order.currency)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPrice(line.rowTotal, order.currency)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totals footer — folded into the Items card, matching the mock's
              own layout (a running total under the line items, not a
              separate card) instead of the standalone "Order Totals" card
              this page used before. */}
          <div className="-mx-6 -mb-2 mt-2 space-y-1.5 border-t bg-muted/30 px-6 py-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatPrice(order.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{order.couponCode ? `Discount (${order.couponCode})` : 'Discount'}</span>
              <span className="font-mono">-{formatPrice(order.discountTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-mono">{formatPrice(order.shippingTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-mono">{formatPrice(order.taxTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Total</span>
              <span className="font-mono">{formatPrice(order.grandTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between pt-1 text-xs text-muted-foreground">
              <span>Paid {formatPrice(paidTotal, order.currency)} · Refunded {formatPrice(refundedTotal, order.currency)}</span>
              <span className="font-semibold text-foreground">Due {formatPrice(remaining, order.currency)}</span>
            </div>
          </div>
        </SectionCard>

        {order.fulfillments.length > 0 ? (
          <SectionCard title="Fulfillment">
            <div className="space-y-4">
              {order.fulfillments.map((f) => (
                <div key={f.publicId} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <Badge variant={statusBadgeVariant(f.status)} className="mt-1">
                      {f.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Carrier</div>
                    <div className="mt-1 font-medium">{f.carrier ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Tracking No.</div>
                    <div className="mt-1 font-mono text-xs font-medium">{f.trackingNumber ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Shipped</div>
                    <div className="mt-1 font-medium">{f.shippedAt ? new Date(f.shippedAt).toLocaleDateString('en-US') : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title="Order &amp; Account Information">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Order Date</dt>
              <dd className="mt-0.5 font-medium">{new Date(order.placedAt).toLocaleString('en-US')}</dd>
            </div>
            {order.customerIp ? (
              <div>
                <dt className="text-muted-foreground">Placed from IP</dt>
                <dd className="mt-0.5 font-medium">{order.customerIp}</dd>
              </div>
            ) : null}
            {order.companyName ? (
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd className="mt-0.5 font-medium">
                  {order.companyPublicId ? (
                    <Link href={`/companies/${order.companyPublicId}`} className="hover:underline">
                      {order.companyName}
                    </Link>
                  ) : (
                    order.companyName
                  )}
                </dd>
              </div>
            ) : null}
            {order.poNumber ? (
              <div>
                <dt className="text-muted-foreground">PO Number</dt>
                <dd className="mt-0.5 font-medium">{order.poNumber}</dd>
              </div>
            ) : null}
            {order.taxExempt ? (
              <div>
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="mt-0.5">
                  <Badge variant="secondary">Tax Exempt</Badge>
                </dd>
              </div>
            ) : null}
          </dl>
        </SectionCard>
      </div>

      {/* Right — Customer / Address / Payment / Notes, matching the mock's
          narrower sidebar column exactly. */}
      <div className="space-y-6">
        <SidebarCard title="Customer">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials(customerName)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{customerName}</div>
              <div className="truncate text-xs text-muted-foreground">{order.email}</div>
            </div>
          </div>
          {billing?.phone ? <div className="mt-3 text-xs text-muted-foreground">{billing.phone}</div> : null}
        </SidebarCard>

        <SidebarCard title="Billing Address">
          <AddressLines address={billing} />
        </SidebarCard>

        <SidebarCard title="Shipping Address">
          <AddressLines address={shipping} />
        </SidebarCard>

        <SidebarCard title="Payment">
          {order.payments.length === 0 ? (
            <p className="text-muted-foreground">{order.paymentMethodCode ? `${paymentMethodLabel(order.paymentMethodCode)} — awaiting payment.` : 'No payment recorded yet.'}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Method</div>
                <div className="mt-0.5 font-medium">{paymentMethodLabel(latestPayment!.method)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant={statusBadgeVariant(latestPayment!.status)} className="mt-1">
                  {latestPayment!.status}
                </Badge>
              </div>
              {/* Every tender, not just the latest — an order can be split
                  across several (card + gift card, wallet + credit terms)
                  since checkout tender support shipped; a single "latest
                  payment" summary would silently hide every other tender's
                  amount, gift cards included. */}
              {order.payments.length > 1 ? (
                <div className="space-y-1.5 border-t pt-3">
                  {order.payments.map((p: OrderPayment, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {paymentMethodLabel(p.method)} · {p.type}
                      </span>
                      <span className="font-mono font-medium">{formatPrice(p.amount, p.currency)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </SidebarCard>

        <SidebarCard title="Notes">
          <div className="space-y-4">
            <AddNoteForm orderPublicId={order.publicId} />
            {order.notes.length === 0 ? (
              <p className="text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {order.notes.map((n) => (
                  <li key={n.id} className="border-t pt-3 first:border-0 first:pt-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={n.type === 'INTERNAL' ? 'secondary' : 'outline'} className="text-[10px]">
                        {n.type}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString('en-US')}</span>
                    </div>
                    <p className="mt-1">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SidebarCard>
      </div>
    </div>
  );
}
