import Link from 'next/link';
import Form from 'next/form';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { FulfillmentList } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShipmentsTable } from './shipments-table';

const DEFAULT_PAGE_SIZE = 20;
const SHIPMENT_STATUSES = ['PENDING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface ShipmentsSearchParams {
  page?: string;
  status?: string;
  carrier?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Every fulfillment across every order, in one list — the data is already
 *  real (created by the existing FulfillOrder flow, per-order); this page
 *  is purely the missing cross-order aggregation (see the Fulfillment
 *  plan's own doc comment). */
export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<ShipmentsSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const baseFilters = {
    status: params.status,
    carrier: params.carrier,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const list = await apiGet<FulfillmentList>(`/admin/v1/fulfillments${buildQuery({ ...baseFilters, page })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.status || params.carrier || params.dateFrom || params.dateTo);

  return (
    <div>
      <div>
        <h1 className="text-[1.32rem] font-extrabold tracking-tight">Shipments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total} shipment{list.total === 1 ? '' : 's'}
        </p>
      </div>

      <Form id="shipments-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/fulfillment/shipments">
        <Input key={params.carrier ?? ''} name="carrier" placeholder="Search carrier…" defaultValue={params.carrier} className="max-w-[240px]" />
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {SHIPMENT_STATUSES.map((s) => (
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
          <Link href="/fulfillment/shipments" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <ShipmentsTable fulfillments={list.fulfillments} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.fulfillments.length ? (page - 1) * list.pageSize + 1 : 0}–{(page - 1) * list.pageSize + list.fulfillments.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/fulfillment/shipments${buildQuery({ ...baseFilters, page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
            <Link href={`/fulfillment/shipments${buildQuery({ ...baseFilters, page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
