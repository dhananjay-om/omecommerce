import Link from 'next/link';
import { apiGet, ApiError, buildQuery } from '@/lib/api-client';
import { ensureWishlist } from '@/lib/wishlist-server';
import { getMyLoyaltyAccount } from '@/services/loyalty.service';
import { formatPrice } from '@/lib/format-price';
import type { Customer, CustomerOrderList } from '@/types/customer';

/** No ACTIVE loyalty program is a normal state (see account/rewards/page.tsx's
 *  own doc comment) — the Points tile just doesn't render rather than showing
 *  a fabricated 0. */
async function loadPointsBalance(): Promise<string | null> {
  try {
    const account = await getMyLoyaltyAccount();
    return account.pointsBalance;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function AccountPage() {
  const [customer, recentOrders, wishlist, pointsBalance] = await Promise.all([
    apiGet<Customer>('/store/v1/me', { auth: true }),
    apiGet<CustomerOrderList>(`/store/v1/me/orders${buildQuery({ page: 1, pageSize: 2 })}`, { auth: true }),
    ensureWishlist(),
    loadPointsBalance(),
  ]);

  const stats = [
    { label: 'Orders', value: String(recentOrders.total), href: '/account/orders' },
    { label: 'Wishlist', value: String(wishlist.items.length), href: '/account/wishlist' },
    ...(pointsBalance !== null ? [{ label: 'Points', value: pointsBalance, href: '/account/rewards' }] : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-xl font-semibold text-jet">
          Welcome back{customer.firstName ? `, ${customer.firstName}` : ''}
        </h2>
        <p className="mt-1 text-sm text-slate">{customer.email}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-ghost bg-ivory p-4 text-center transition-colors hover:border-champagne"
          >
            <p className="text-2xl font-bold text-jet">{s.value}</p>
            <p className="mt-0.5 text-xs tracking-wide text-slate uppercase">{s.label}</p>
          </Link>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-widest text-jet uppercase">Recent Orders</h3>
          <Link href="/account/orders" className="text-sm font-medium text-champagne hover:text-jet">
            View all
          </Link>
        </div>
        {recentOrders.orders.length === 0 ? (
          <p className="text-sm text-slate">You haven&apos;t placed any orders yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentOrders.orders.map((order) => (
              <Link
                key={order.publicId}
                href={`/account/orders/${order.publicId}`}
                className="flex items-center justify-between rounded-2xl border border-ghost p-4 text-sm transition-colors hover:border-champagne"
              >
                <div>
                  <p className="font-medium text-jet">#{order.orderNumber}</p>
                  <p className="text-xs text-slate">
                    {new Date(order.placedAt).toLocaleDateString()} · {order.itemsCount} item{order.itemsCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-jet">{formatPrice(order.grandTotal, order.currency)}</p>
                  <p className="text-xs text-slate">{order.fulfillmentStatus}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
