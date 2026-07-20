import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { CustomerOrderListItem } from '@/types/customer';

export const metadata = { title: 'Order History' };

function statusColor(status: string): string {
  switch (status) {
    case 'PAID':
    case 'DELIVERED':
    case 'FULFILLED':
      return 'text-success';
    case 'CANCELLED':
    case 'FAILED':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

export default async function OrdersPage() {
  const orders = await apiGet<CustomerOrderListItem[]>('/store/v1/me/orders', { auth: true });

  if (orders.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Orders</h2>
        <p className="mt-2 text-muted-foreground">You haven&apos;t placed any orders yet.</p>
        <Link href="/products" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Orders</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Payment</th>
              <th className="px-4 py-2 font-medium">Fulfillment</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.publicId} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">#{order.orderNumber}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(order.placedAt).toLocaleDateString()}</td>
                <td className={`px-4 py-3 font-medium ${statusColor(order.financialStatus)}`}>{order.financialStatus}</td>
                <td className={`px-4 py-3 font-medium ${statusColor(order.fulfillmentStatus)}`}>{order.fulfillmentStatus}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {order.currency} {Number(order.grandTotal).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
