import Link from 'next/link';
import Form from 'next/form';
import { Plus, Search } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { GiftCardList, GiftCardStatus } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { GiftCardsTable } from './gift-cards-table';

const PAGE_SIZE = 20;
const STATUSES: GiftCardStatus[] = ['ACTIVE', 'REDEEMED', 'EXPIRED', 'DISABLED', 'PENDING'];
const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export default async function GiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; last4?: string; recipientEmail?: string; status?: GiftCardStatus }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const list = await apiGet<GiftCardList>(
    `/admin/v1/gift-cards${buildQuery({ page, pageSize: PAGE_SIZE, last4: params.last4, recipientEmail: params.recipientEmail, status: params.status })}`,
  );
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.last4 || params.recipientEmail || params.status);

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/gift-cards' }, { label: 'Gift Cards' }]} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Gift Cards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} gift card{list.total === 1 ? '' : 's'} issued
          </p>
        </div>
        <Link href="/gift-cards/new" className={cn(buttonVariants({ size: 'sm' }))}>
          <Plus className="size-3.5" />
          Issue Gift Card
        </Link>
      </div>

      {/* next/form: a plain <form action="/gift-cards"> doesn't respect
          this app's /admin basePath, the same pre-existing bug already
          fixed on Orders/Products/Customers. */}
      <Form id="gift-cards-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/gift-cards">
        <div className="relative max-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input name="last4" placeholder="Last 4 digits…" defaultValue={params.last4} className="pl-8" />
        </div>
        <Input name="recipientEmail" placeholder="Recipient email…" defaultValue={params.recipientEmail} className="max-w-sm flex-1" />
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/gift-cards" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <GiftCardsTable giftCards={list.giftCards} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.giftCards.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + list.giftCards.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link
              href={`/gift-cards${buildQuery({ page: page - 1, last4: params.last4, recipientEmail: params.recipientEmail, status: params.status })}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
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
            <Link
              href={`/gift-cards${buildQuery({ page: page + 1, last4: params.last4, recipientEmail: params.recipientEmail, status: params.status })}`}
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
