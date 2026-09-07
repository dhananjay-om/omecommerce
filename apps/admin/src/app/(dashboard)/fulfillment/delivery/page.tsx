import Link from 'next/link';
import Form from 'next/form';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { FulfillmentList, DeliveryBreakdown } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatCard } from '@/components/reports/stat-card';
import { cn } from '@/lib/utils';
import { DeliveryTable } from './delivery-table';

const DEFAULT_PAGE_SIZE = 20;
const SHIPMENT_STATUSES = ['PENDING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface DeliverySearchParams {
  page?: string;
  status?: string;
  delayed?: string;
}

/** Delivery status and SLA tracking — the same Fulfillment/ShipmentTracking
 *  data Shipments surfaces, led with a delivered/in-transit/delayed
 *  breakdown (see GetDeliveryBreakdown's own doc comment) instead of
 *  carrier detail. "Delayed" is a real, computed flag (not yet DELIVERED/
 *  CANCELLED and past its ETA), not a fabricated SLA metric. */
export default async function DeliveryPage({ searchParams }: { searchParams: Promise<DeliverySearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const delayedOnly = params.delayed === 'true';

  const baseFilters = { status: params.status, delayed: params.delayed, pageSize: DEFAULT_PAGE_SIZE };

  const [breakdown, list] = await Promise.all([
    apiGet<DeliveryBreakdown>('/admin/v1/fulfillments/delivery-breakdown'),
    apiGet<FulfillmentList>(`/admin/v1/fulfillments${buildQuery({ ...baseFilters, page })}`),
  ]);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.status || delayedOnly);
  const inTransit = breakdown.pending + breakdown.packed + breakdown.shipped;

  return (
    <div>
      <div>
        <h1 className="text-[1.32rem] font-extrabold tracking-tight">Delivery</h1>
        <p className="mt-1 text-sm text-muted-foreground">Delivery status and SLA tracking across shipments.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="In transit" value={String(inTransit)} sub={`${breakdown.pending} pending, ${breakdown.packed} packed, ${breakdown.shipped} shipped`} />
        <StatCard label="Delivered" value={String(breakdown.delivered)} />
        <StatCard label="Delayed" value={String(breakdown.delayed)} sub="Past their estimated delivery date" />
        <StatCard label="Cancelled" value={String(breakdown.cancelled)} />
      </div>

      <Form id="delivery-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/fulfillment/delivery">
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {SHIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="delayed" value="true" defaultChecked={delayedOnly} className="size-4" />
          Delayed only
        </label>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/fulfillment/delivery" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <DeliveryTable fulfillments={list.fulfillments} />
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
            <Link href={`/fulfillment/delivery${buildQuery({ ...baseFilters, page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
            <Link href={`/fulfillment/delivery${buildQuery({ ...baseFilters, page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
