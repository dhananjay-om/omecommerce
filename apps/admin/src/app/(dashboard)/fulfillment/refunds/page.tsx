import Link from 'next/link';
import Form from 'next/form';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { RefundList } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatCard } from '@/components/reports/stat-card';
import { formatPrice } from '@/lib/format-price';
import { cn } from '@/lib/utils';
import { RefundsTable } from './refunds-table';

const DEFAULT_PAGE_SIZE = 20;
const REFUND_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'];

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface RefundsSearchParams {
  page?: string;
  method?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Every refund issued, in one list — the data is already real (every
 *  refund RefundOrder issues writes a real PaymentTransaction row); this
 *  page is purely the missing cross-order ledger view. */
export default async function RefundsPage({ searchParams }: { searchParams: Promise<RefundsSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const baseFilters = { method: params.method, status: params.status, dateFrom: params.dateFrom, dateTo: params.dateTo, pageSize: DEFAULT_PAGE_SIZE };

  const list = await apiGet<RefundList>(`/admin/v1/refunds${buildQuery({ ...baseFilters, page })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.method || params.status || params.dateFrom || params.dateTo);

  return (
    <div>
      <div>
        <h1 className="text-[1.32rem] font-extrabold tracking-tight">Refunds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total} refund{list.total === 1 ? '' : 's'}
        </p>
      </div>

      {list.totalsByCurrency.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {list.totalsByCurrency.map((t) => (
            <StatCard key={t.currency} label={`Total refunded (${t.currency})`} value={formatPrice(t.total, t.currency)} />
          ))}
        </div>
      ) : null}

      <Form id="refunds-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/fulfillment/refunds">
        <Input key={params.method ?? ''} name="method" placeholder="Search method…" defaultValue={params.method} className="max-w-[220px]" />
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {REFUND_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Input key={`from-${params.dateFrom ?? ''}`} name="dateFrom" type="date" defaultValue={params.dateFrom} className="w-auto" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input key={`to-${params.dateTo ?? ''}`} name="dateTo" type="date" defaultValue={params.dateTo} className="w-auto" />
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/fulfillment/refunds" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <RefundsTable refunds={list.refunds} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.refunds.length ? (page - 1) * list.pageSize + 1 : 0}–{(page - 1) * list.pageSize + list.refunds.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/fulfillment/refunds${buildQuery({ ...baseFilters, page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
            <Link href={`/fulfillment/refunds${buildQuery({ ...baseFilters, page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
