import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { CustomerOrderList, CustomerOrderListItem } from '@/types/customer';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format-price';
import { OrderRowActions } from '@/components/account/order-row-actions';

export const metadata = { title: 'Order History' };

const PAGE_SIZE = 10;

/** Same 3-state grouping the old table's statusColor() used (paid/delivered-ish
 *  → success, cancelled/failed → destructive, anything else → neutral/pending)
 *  — just rendered as a themed pill instead of colored text. */
function statusPillClass(status: string): string {
  switch (status) {
    case 'PAID':
    case 'DELIVERED':
    case 'FULFILLED':
    case 'CLOSED':
      return 'bg-green-50 text-green-700';
    case 'CANCELLED':
    case 'FAILED':
      return 'bg-rose/10 text-rose';
    default:
      return 'bg-sand text-charcoal';
  }
}

function StatusPill({ status }: { status: string }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusPillClass(status))}>{status}</span>;
}

function OrderCard({ order }: { order: CustomerOrderListItem }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ghost">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-ivory px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <div>
            <p className="text-xs text-slate">Order</p>
            <Link href={`/account/orders/${order.publicId}`} className="font-medium text-jet hover:text-champagne">
              #{order.orderNumber}
            </Link>
          </div>
          <div>
            <p className="text-xs text-slate">Placed</p>
            <p className="text-jet">{new Date(order.placedAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate">Total</p>
            <p className="font-semibold text-jet">{formatPrice(order.grandTotal, order.currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={order.financialStatus} />
          <StatusPill status={order.fulfillmentStatus} />
          <OrderRowActions orderPublicId={order.publicId} />
        </div>
      </div>
      <div className="px-4 py-3 text-sm text-charcoal">
        {order.itemsCount} item{order.itemsCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const list = await apiGet<CustomerOrderList>(`/store/v1/me/orders${buildQuery({ page, pageSize: PAGE_SIZE, search: params.search })}`, { auth: true });
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  if (list.total === 0 && !params.search) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-jet">Orders</h2>
        <p className="mt-2 text-slate">You haven&apos;t placed any orders yet.</p>
        <Link href="/products" className="mt-3 inline-block text-sm font-medium text-champagne hover:text-jet">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-jet">Orders</h2>
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
        <p className="text-slate">No orders match your search.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {list.orders.map((order) => (
            <OrderCard key={order.publicId} order={order} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate">
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
