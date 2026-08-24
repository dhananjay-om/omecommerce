import Link from 'next/link';
import Form from 'next/form';
import { Search } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { CustomerList } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { CustomersTable } from './customers-table';

const PAGE_SIZE = 20;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const list = await apiGet<CustomerList>(`/admin/v1/customers${buildQuery({ page, pageSize: PAGE_SIZE, search: params.search })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/customers' }, { label: 'Customers' }]} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} customer{list.total === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Single search box — matches the mock's clean filter-bar shape
          (Orders/Products use the same convention). No status filter here:
          the customers list API (listCustomersQuerySchema) only accepts
          page/pageSize/search, so an isActive dropdown would look
          functional in the URL but silently do nothing on the backend —
          not added, same "don't fake a working filter" rule as everywhere
          else in this revamp. The mock's own columns also carry Orders/
          Revenue/AOV/Last Order/Segment/LTV, none of which this API
          returns either (no order aggregation joined in) — not faked.
          next/form: a plain <form action="/customers"> doesn't respect
          this app's /admin basePath, the same pre-existing bug already
          fixed on Orders/Products. */}
      <Form id="customers-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/customers">
        <div className="relative max-w-[320px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input key={params.search ?? ''} name="search" placeholder="Search name or email…" defaultValue={params.search} className="pl-8" />
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {params.search ? (
          <Link href="/customers" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <CustomersTable customers={list.customers} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.customers.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + list.customers.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/customers${buildQuery({ page: page - 1, search: params.search })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Previous
            </Link>
          )}
          <span className="px-1">
            {page} / {totalPages}
          </span>
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Link href={`/customers${buildQuery({ page: page + 1, search: params.search })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
