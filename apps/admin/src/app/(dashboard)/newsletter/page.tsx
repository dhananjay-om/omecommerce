import Link from 'next/link';
import Form from 'next/form';
import { Search } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { NewsletterSubscriberList } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { AddSubscriberDialog } from './add-subscriber-dialog';
import { SubscriberRowActions } from './subscriber-row-actions';

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Subscribed', value: 'SUBSCRIBED' },
  { label: 'Unsubscribed', value: 'UNSUBSCRIBED' },
] as const;

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const status = params.status === 'SUBSCRIBED' || params.status === 'UNSUBSCRIBED' ? params.status : undefined;

  const list = await apiGet<NewsletterSubscriberList>(
    `/admin/v1/newsletter/subscribers${buildQuery({ page, pageSize: PAGE_SIZE, search: params.search, status })}`,
  );
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const exportHref = `/api/newsletter/export${buildQuery({ search: params.search, status })}`;

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/newsletter' }, { label: 'Newsletter' }]} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Newsletter Subscribers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People who signed up through the storefront&apos;s newsletter forms. {list.counts.subscribed} subscribed
            · {list.counts.unsubscribed} unsubscribed.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Plain download link — the /api route streams the CSV with the session cookie. */}
          <a href={exportHref} className={cn(buttonVariants({ variant: 'outline' }))}>
            Export CSV
          </a>
          <AddSubscriberDialog />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={`/newsletter${buildQuery({ status: tab.value, search: params.search })}`}
            className={cn(buttonVariants({ variant: status === tab.value ? 'default' : 'outline', size: 'sm' }))}
          >
            {tab.label}
          </Link>
        ))}
        <Form id="newsletter-filters" className="ml-auto flex items-center gap-2" action="/newsletter">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="relative w-[280px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input key={params.search ?? ''} name="search" placeholder="Search email…" defaultValue={params.search} className="pl-8" />
          </div>
          <Button type="submit" size="sm">
            Search
          </Button>
          {params.search ? (
            <Link href={`/newsletter${buildQuery({ status })}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
              Clear
            </Link>
          ) : null}
        </Form>
      </div>

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.subscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {params.search || status ? 'No subscribers match this filter.' : 'No subscribers yet — they appear here as visitors sign up on the storefront.'}
                </TableCell>
              </TableRow>
            ) : (
              list.subscribers.map((s) => (
                <TableRow key={s.publicId}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'SUBSCRIBED' ? 'success' : 'secondary'}>{s.status === 'SUBSCRIBED' ? 'Subscribed' : 'Unsubscribed'}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{s.source}</TableCell>
                  <TableCell>{new Date(s.subscribedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <SubscriberRowActions publicId={s.publicId} email={s.email} status={s.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.subscribers.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + list.subscribers.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/newsletter${buildQuery({ page: page - 1, search: params.search, status })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
            <Link href={`/newsletter${buildQuery({ page: page + 1, search: params.search, status })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
