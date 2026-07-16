import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { ProductList, OrderList, CustomerList } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Package, ShoppingCart, Users } from 'lucide-react';

async function fetchTotal<T extends { total: number }>(path: string): Promise<number> {
  try {
    const result = await apiGet<T>(path);
    return result.total;
  } catch {
    return 0;
  }
}

export default async function DashboardPage() {
  const [productTotal, orderTotal, customerTotal, recentOrders] = await Promise.all([
    fetchTotal<ProductList>('/admin/v1/products?pageSize=1'),
    fetchTotal<OrderList>('/admin/v1/orders?pageSize=1'),
    fetchTotal<CustomerList>('/admin/v1/customers?pageSize=1'),
    apiGet<OrderList>('/admin/v1/orders?pageSize=5'),
  ]);

  const cards = [
    { label: 'Total Products', value: productTotal, icon: Package, href: '/products' },
    { label: 'Total Orders', value: orderTotal, icon: ShoppingCart, href: '/orders' },
    { label: 'Total Customers', value: customerTotal, icon: Users, href: '/customers' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent">
                <Icon className="size-5 text-accent-foreground" strokeWidth={2} />
              </div>
              <div className="mt-4 text-sm font-medium text-muted-foreground">{card.label}</div>
              <div className="mt-1 text-3xl font-bold">{card.value}</div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Orders</h2>
          <Link href="/orders" className="text-sm font-medium text-primary hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-3 rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Grand Total</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentOrders.orders.map((o) => (
                  <TableRow key={o.publicId}>
                    <TableCell className="font-medium">
                      <Link href={`/orders/${o.publicId}`} className="hover:underline">
                        {o.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{o.email}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(o.status)}>{o.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {o.currency} {o.grandTotal}
                    </TableCell>
                    <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
