import Link from 'next/link';
import Form from 'next/form';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { ReturnList } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReturnsTable } from './returns-table';

const DEFAULT_PAGE_SIZE = 20;
const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED'];

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface ReturnsSearchParams {
  page?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Every return request across every order, in one list — a new record is
 *  created from the order detail page's own "Create Return" dialog
 *  (admin-recorded, no customer self-service in this pass); this page is
 *  the cross-order queue, with Approve/Mark Received/Refund/Reject
 *  actions per row moving it through its real lifecycle. */
export default async function ReturnsPage({ searchParams }: { searchParams: Promise<ReturnsSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const baseFilters = { status: params.status, dateFrom: params.dateFrom, dateTo: params.dateTo, pageSize: DEFAULT_PAGE_SIZE };

  const list = await apiGet<ReturnList>(`/admin/v1/returns${buildQuery({ ...baseFilters, page })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.status || params.dateFrom || params.dateTo);

  return (
    <div>
      <div>
        <h1 className="text-[1.32rem] font-extrabold tracking-tight">Returns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total} return{list.total === 1 ? '' : 's'} · Create one from an order&apos;s own page
        </p>
      </div>

      <Form id="returns-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/fulfillment/returns">
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {RETURN_STATUSES.map((s) => (
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
          <Link href="/fulfillment/returns" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <ReturnsTable returns={list.returns} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.returns.length ? (page - 1) * list.pageSize + 1 : 0}–{(page - 1) * list.pageSize + list.returns.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/fulfillment/returns${buildQuery({ ...baseFilters, page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
            <Link href={`/fulfillment/returns${buildQuery({ ...baseFilters, page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
