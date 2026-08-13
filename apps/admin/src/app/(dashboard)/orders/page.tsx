import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { OrderList } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OrdersTable, type SortKey } from './orders-table';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED'];
const FINANCIAL_STATUSES = ['PENDING', 'AUTHORIZED', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED', 'FAILED'];
const FULFILLMENT_STATUSES = ['UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'RETURNED'];

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface OrdersSearchParams {
  page?: string;
  pageSize?: string;
  email?: string;
  status?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  orderId?: string;
  customerName?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: string;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<OrdersSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const pageSize = params.pageSize ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;
  const sortBy = (['createdAt', 'grandTotal', 'customerName'].includes(params.sortBy ?? '') ? params.sortBy : 'createdAt') as SortKey;
  const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';

  const baseFilters = {
    email: params.email,
    status: params.status,
    financialStatus: params.financialStatus,
    fulfillmentStatus: params.fulfillmentStatus,
    orderId: params.orderId,
    customerName: params.customerName,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    pageSize,
  };

  const list = await apiGet<OrderList>(`/admin/v1/orders${buildQuery({ ...baseFilters, page, sortBy, sortDir })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  function sortHref(column: SortKey): string {
    const nextDir = sortBy === column && sortDir === 'asc' ? 'desc' : 'asc';
    return `/orders${buildQuery({ ...baseFilters, page: 1, sortBy: column, sortDir: nextDir })}`;
  }
  const sortLinks: Record<SortKey, string> = {
    createdAt: sortHref('createdAt'),
    grandTotal: sortHref('grandTotal'),
    customerName: sortHref('customerName'),
  };

  const hasFilters = Boolean(
    params.email || params.status || params.financialStatus || params.fulfillmentStatus || params.orderId || params.customerName || params.dateFrom || params.dateTo,
  );
  const exportFilters = {
    email: params.email,
    status: params.status,
    financialStatus: params.financialStatus,
    fulfillmentStatus: params.fulfillmentStatus,
    orderId: params.orderId,
    customerName: params.customerName,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <div className="flex gap-2">
          <a href={`/admin/api/orders/export${buildQuery({ ...exportFilters, format: 'csv' })}`} className={cn(buttonVariants({ variant: 'outline' }))}>
            Export CSV
          </a>
          <a href={`/admin/api/orders/export${buildQuery({ ...exportFilters, format: 'xlsx' })}`} className={cn(buttonVariants({ variant: 'outline' }))}>
            Export Excel
          </a>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-2" action="/orders">
        <Input key={params.orderId ?? ''} name="orderId" placeholder="Order # or ID…" defaultValue={params.orderId} className="max-w-[160px]" />
        <Input key={params.email ?? ''} name="email" placeholder="Email…" defaultValue={params.email} className="max-w-[180px]" />
        <Input key={params.customerName ?? ''} name="customerName" placeholder="Customer name…" defaultValue={params.customerName} className="max-w-[180px]" />
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="financialStatus" defaultValue={params.financialStatus ?? ''} className={nativeSelectClass}>
          <option value="">All Payment Statuses</option>
          {FINANCIAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="fulfillmentStatus" defaultValue={params.fulfillmentStatus ?? ''} className={nativeSelectClass}>
          <option value="">All Fulfillment Statuses</option>
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Input type="date" name="dateFrom" defaultValue={params.dateFrom} className="w-[150px]" aria-label="From date" />
        <Input type="date" name="dateTo" defaultValue={params.dateTo} className="w-[150px]" aria-label="To date" />
        <select name="pageSize" defaultValue={String(pageSize)} className={nativeSelectClass}>
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/orders" className={cn(buttonVariants({ variant: 'ghost' }))}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-6">
        <OrdersTable orders={list.orders} sortLinks={sortLinks} activeSortBy={sortBy} activeSortDir={sortDir} />
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
            <Link href={`/orders${buildQuery({ ...baseFilters, page: page - 1, sortBy, sortDir })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Previous
            </Link>
          )}
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Link href={`/orders${buildQuery({ ...baseFilters, page: page + 1, sortBy, sortDir })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
