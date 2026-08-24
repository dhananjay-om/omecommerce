import Link from 'next/link';
import Form from 'next/form';
import { Search } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { OrderList } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OrdersTable, type SortKey } from './orders-table';
import { ExportMenu } from './export-menu';
import { MoreFiltersPopover } from './more-filters-popover';

const DEFAULT_PAGE_SIZE = 20;
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED'];
const FINANCIAL_STATUSES = ['PENDING', 'AUTHORIZED', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED', 'FAILED'];

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface OrdersSearchParams {
  page?: string;
  pageSize?: string;
  q?: string;
  status?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: string;
}

/** One visible search box (matching the mock's single "Search order #,
 *  customer, email, tracking…" input), classified server-side into
 *  whichever of this API's 3 separate filter params actually fits what was
 *  typed — an email-looking string searches by email, an all-digits
 *  string (optionally "#"-prefixed) searches by order #, anything else
 *  searches by customer name. Real routing to 3 real backend filters
 *  behind one field, not a fake single field with no effect. */
function classifySearch(q: string): { orderId?: string; email?: string; customerName?: string } {
  const trimmed = q.trim();
  if (!trimmed) return {};
  if (trimmed.includes('@')) return { email: trimmed };
  if (/^#?\d+$/.test(trimmed)) return { orderId: trimmed.replace(/^#/, '') };
  return { customerName: trimmed };
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<OrdersSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const pageSize = params.pageSize ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;
  const sortBy = (['createdAt', 'grandTotal', 'customerName'].includes(params.sortBy ?? '') ? params.sortBy : 'createdAt') as SortKey;
  const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';
  const search = classifySearch(params.q ?? '');

  const baseFilters = {
    ...search,
    status: params.status,
    financialStatus: params.financialStatus,
    fulfillmentStatus: params.fulfillmentStatus,
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

  const hasFilters = Boolean(params.q || params.status || params.financialStatus || params.fulfillmentStatus || params.dateFrom || params.dateTo);
  const moreFiltersActiveCount = [params.fulfillmentStatus, params.dateFrom, params.dateTo].filter(Boolean).length;
  const exportFilters = { ...search, status: params.status, financialStatus: params.financialStatus, fulfillmentStatus: params.fulfillmentStatus, dateFrom: params.dateFrom, dateTo: params.dateTo };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} order{list.total === 1 ? '' : 's'}
          </p>
        </div>
        <ExportMenu
          csvHref={`/admin/api/orders/export${buildQuery({ ...exportFilters, format: 'csv' })}`}
          xlsxHref={`/admin/api/orders/export${buildQuery({ ...exportFilters, format: 'xlsx' })}`}
        />
      </div>

      {/* One search box + 2 dropdowns + "More filters" — matches the mock's
          clean filter-bar shape. The single search box submits one param
          ("q"), classified server-side into 3 real backend filters above,
          so real filtering is unchanged even though only one input is
          visible now. Everything here still submits as ONE native form
          (Next.js Server Component pages use plain GET-form navigation,
          not client-side filtering) — the popover's own inputs use the
          HTML `form` attribute to submit into this form despite being
          portaled elsewhere in the DOM. */}
      {/* next/form (not a plain <form>): this app is reverse-proxied at the
          /admin basePath (next.config.ts) — Next.js's `Link`/`router.push`
          both account for that automatically, but a plain `<form
          action="/orders">` does NOT, so submitting it would 404 in any
          environment where the basePath is actually enforced (found and
          fixed while rebuilding this filter bar — the exact same bug
          existed in the form this replaces; worth checking whether other
          pages' filter forms have it too, not swept here). */}
      <Form id="orders-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/orders">
        <div className="relative max-w-[320px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input key={params.q ?? ''} name="q" placeholder="Search order #, customer, email…" defaultValue={params.q} className="pl-8" />
        </div>
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="financialStatus" defaultValue={params.financialStatus ?? ''} className={nativeSelectClass}>
          <option value="">All payment statuses</option>
          {FINANCIAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <MoreFiltersPopover
          formId="orders-filters"
          fulfillmentStatus={params.fulfillmentStatus}
          dateFrom={params.dateFrom}
          dateTo={params.dateTo}
          pageSize={pageSize}
          activeCount={moreFiltersActiveCount}
        />
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/orders" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <OrdersTable orders={list.orders} sortLinks={sortLinks} activeSortBy={sortBy} activeSortDir={sortDir} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.orders.length ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize + list.orders.length} of {list.total}
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
          <span className="px-1">
            {page} / {totalPages}
          </span>
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
