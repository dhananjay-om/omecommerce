import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { OrderList } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { statusBadgeVariant } from '@/lib/status-badge';

const PAGE_SIZE = 20;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; email?: string; status?: string; financialStatus?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const list = await apiGet<OrderList>(
    `/admin/v1/orders${buildQuery({
      page,
      pageSize: PAGE_SIZE,
      email: params.email,
      status: params.status,
      financialStatus: params.financialStatus,
    })}`,
  );
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Orders</h1>

      <form className="mt-6 flex gap-2" action="/orders">
        <Input name="email" placeholder="Search by email…" defaultValue={params.email} className="max-w-sm" />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {params.email || params.status || params.financialStatus ? (
          <Link href="/orders" className={cn(buttonVariants({ variant: 'ghost' }))}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Financial</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Grand Total</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              list.orders.map((o) => (
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
                    <Badge variant={statusBadgeVariant(o.financialStatus)}>{o.financialStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(o.fulfillmentStatus)}>{o.fulfillmentStatus}</Badge>
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
            <Link
              href={`/orders${buildQuery({ page: page - 1, email: params.email, status: params.status })}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Previous
            </Link>
          )}
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Link
              href={`/orders${buildQuery({ page: page + 1, email: params.email, status: params.status })}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
