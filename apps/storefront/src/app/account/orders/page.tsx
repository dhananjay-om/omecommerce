import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { CustomerOrderList } from '@/types/customer';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format-price';
import { OrderRowActions } from '@/components/account/order-row-actions';

export const metadata = { title: 'Order History' };

const PAGE_SIZE = 10;

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

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const list = await apiGet<CustomerOrderList>(`/store/v1/me/orders${buildQuery({ page, pageSize: PAGE_SIZE, search: params.search })}`, { auth: true });
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  if (list.total === 0 && !params.search) {
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Orders</h2>
        <form className="flex gap-2" action="/account/orders">
          <Input key={params.search ?? ''} name="search" placeholder="Search by order #…" defaultValue={params.search} className="max-w-[200px]" />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
          {params.search ? (
            <Link href="/account/orders" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      {list.orders.length === 0 ? (
        <p className="text-muted-foreground">No orders match your search.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Items</th>
                <th className="px-4 py-2 font-medium">Payment</th>
                <th className="px-4 py-2 font-medium">Fulfillment</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="w-10 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.orders.map((order) => (
                <tr key={order.publicId} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/account/orders/${order.publicId}`} className="hover:underline">
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(order.placedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{order.itemsCount}</td>
                  <td className={`px-4 py-3 font-medium ${statusColor(order.financialStatus)}`}>{order.financialStatus}</td>
                  <td className={`px-4 py-3 font-medium ${statusColor(order.fulfillmentStatus)}`}>{order.fulfillmentStatus}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrice(order.grandTotal, order.currency)}</td>
                  <td className="px-4 py-3">
                    <OrderRowActions orderPublicId={order.publicId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {list.total} order{list.total === 1 ? '' : 's'} · page {list.page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/account/orders${buildQuery({ page: page - 1, search: params.search })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Previous
            </Link>
          )}
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Link href={`/account/orders${buildQuery({ page: page + 1, search: params.search })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
