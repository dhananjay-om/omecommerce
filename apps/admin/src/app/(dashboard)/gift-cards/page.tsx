import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { GiftCardList, GiftCardStatus } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

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
  const hasFilters = !!(params.last4 || params.recipientEmail || params.status);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Gift Cards</h1>
        <Link href="/gift-cards/new" className={cn(buttonVariants())}>
          Issue Gift Card
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap gap-2" action="/gift-cards">
        <Input name="last4" placeholder="Last 4 digits…" defaultValue={params.last4} className="max-w-40" />
        <Input name="recipientEmail" placeholder="Recipient email…" defaultValue={params.recipientEmail} className="max-w-sm" />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {hasFilters ? (
          <Link href="/gift-cards" className={cn(buttonVariants({ variant: 'ghost' }))}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Last 4</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Initial</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.giftCards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No gift cards found.
                </TableCell>
              </TableRow>
            ) : (
              list.giftCards.map((c) => (
                <TableRow key={c.publicId}>
                  <TableCell className="font-mono">•••• {c.codeLast4}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{c.kind}</TableCell>
                  <TableCell>{formatPrice(c.initialAmount, c.currency)}</TableCell>
                  <TableCell>{formatPrice(c.balance, c.currency)}</TableCell>
                  <TableCell>{c.recipientEmail ?? '—'}</TableCell>
                  <TableCell>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Link href={`/gift-cards/${c.publicId}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {list.total} gift card{list.total === 1 ? '' : 's'} · page {list.page} of {totalPages}
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
