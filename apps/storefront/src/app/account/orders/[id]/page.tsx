import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCustomerOrder } from '@/services/order.service';
import { ApiError } from '@/lib/api-client';
import { formatPrice } from '@/lib/format-price';
import type { OrderAddress } from '@/types/order';
import { ReorderButton } from '@/components/account/reorder-button';

export const metadata: Metadata = { title: 'Order Details' };

function statusColor(status: string): string {
  switch (status) {
    case 'PAID':
    case 'DELIVERED':
    case 'FULFILLED':
    case 'CLOSED':
      return 'text-success';
    case 'CANCELLED':
    case 'FAILED':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

function AddressBlock({ label, address }: { label: string; address: OrderAddress | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase">{label}</div>
      {address ? (
        <div className="mt-1 text-sm">
          <div>{address.name}</div>
          {address.company ? <div>{address.company}</div> : null}
          <div>{address.line1}</div>
          {address.line2 ? <div>{address.line2}</div> : null}
          <div>
            {address.city}, {address.region ?? ''} {address.postalCode}
          </div>
          <div>{address.country}</div>
        </div>
      ) : (
        <div className="mt-1 text-sm text-muted-foreground">—</div>
      )}
    </div>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let order;
  try {
    order = await getCustomerOrder(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');

  return (
    <div>
      <Link href="/account/orders" className="text-sm text-muted-foreground hover:underline">
        ← Back to Orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Order #{order.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">Placed {new Date(order.placedAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/account/orders/${order.publicId}/tracking`} className="text-sm font-medium text-primary hover:underline">
            Track Shipment
          </Link>
          {order.invoices.length > 0 ? (
            <a href={`/api/account/orders/${order.publicId}/invoice`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
              Download Invoice
            </a>
          ) : null}
          <ReorderButton orderPublicId={order.publicId} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className={`font-medium ${statusColor(order.status)}`}>{order.status}</span>
        <span className={`font-medium ${statusColor(order.financialStatus)}`}>{order.financialStatus}</span>
        <span className={`font-medium ${statusColor(order.fulfillmentStatus)}`}>{order.fulfillmentStatus}</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <AddressBlock label="Billing Address" address={billing} />
        <AddressBlock label="Shipping Address" address={shipping} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.sku} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{line.name}</div>
                  <div className="text-xs text-muted-foreground">SKU: {line.sku}</div>
                </td>
                <td className="px-4 py-3">{line.qty}</td>
                <td className="px-4 py-3 text-right">{formatPrice(line.rowTotal, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 ml-auto flex max-w-xs flex-col gap-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatPrice(order.subtotal, order.currency)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Discount</span>
          <span>-{formatPrice(order.discountTotal, order.currency)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Shipping</span>
          <span>{formatPrice(order.shippingTotal, order.currency)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Tax</span>
          <span>{formatPrice(order.taxTotal, order.currency)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 text-base font-bold">
          <span>Total</span>
          <span>{formatPrice(order.grandTotal, order.currency)}</span>
        </div>
      </div>

      {order.notes.length > 0 ? (
        <div className="mt-8">
          <h3 className="mb-2 text-sm font-semibold">Notes</h3>
          <ul className="flex flex-col gap-2">
            {order.notes.map((note) => (
              <li key={note.id} className="rounded-lg border p-3 text-sm">
                <div className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</div>
                <p className="mt-1">{note.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
