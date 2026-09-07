import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { PickList } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PickTicketCard } from './pick-ticket-card';

const DEFAULT_PAGE_SIZE = 10;

interface PickPackSearchParams {
  page?: string;
}

/** The warehouse picking/packing queue — every paid, not-yet-fully-
 *  fulfilled order, oldest first (real FIFO picking priority), each with
 *  its real bin locations where set and the exact same "Pack & Ship"
 *  action (FulfillDialog) the order detail page already uses. Genuinely
 *  new domain (see the Fulfillment plan's own doc comment) — no pick-
 *  list/bin-location concept existed anywhere before this. Deliberately
 *  does NOT add package-type/weight capture (the original nav copy's own
 *  promise) — no real field or consumer for that data exists, and this
 *  pass doesn't invent one just to match the copy; the description below
 *  was trimmed to what's actually built. */
export default async function PickPackPage({ searchParams }: { searchParams: Promise<PickPackSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const list = await apiGet<PickList>(`/admin/v1/pick-list${buildQuery({ page, pageSize: DEFAULT_PAGE_SIZE })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div>
      <div>
        <h1 className="text-[1.32rem] font-extrabold tracking-tight">Pick &amp; Pack</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total} order{list.total === 1 ? '' : 's'} ready to pick, oldest first
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {list.orders.length === 0 ? (
          <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            Nothing to pick right now — every paid order is already fulfilled.
          </p>
        ) : (
          list.orders.map((order) => <PickTicketCard key={order.orderPublicId} order={order} />)
        )}
      </div>

      {list.total > list.pageSize ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {list.orders.length ? (page - 1) * list.pageSize + 1 : 0}–{(page - 1) * list.pageSize + list.orders.length} of {list.total}
          </span>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Link href={`/fulfillment/pick-pack${buildQuery({ page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
              <Link href={`/fulfillment/pick-pack${buildQuery({ page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                Next
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
