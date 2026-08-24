import Link from 'next/link';
import Form from 'next/form';
import { Search } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { CompanyList, CompanyStatus, Website } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { CompaniesTable } from './companies-table';

const PAGE_SIZE = 20;
const COMPANY_STATUSES: CompanyStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'];

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; websiteCode?: string; status?: CompanyStatus; q?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const [list, websites] = await Promise.all([
    apiGet<CompanyList>(
      `/admin/v1/companies${buildQuery({ page, pageSize: PAGE_SIZE, websiteCode: params.websiteCode, status: params.status, q: params.q })}`,
    ),
    apiGet<Website[]>('/admin/v1/websites'),
  ]);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.websiteCode || params.status || params.q);

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'B2B', href: '/companies' }, { label: 'Companies' }]} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Companies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} compan{list.total === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <Link href="/companies/new" className={cn(buttonVariants({ size: 'sm' }))}>
          New Company
        </Link>
      </div>

      {/* next/form: a plain <form action="/companies"> doesn't respect
          this app's /admin basePath, the same pre-existing bug already
          fixed on Orders/Products/Customers/Gift Cards/Referrals. */}
      <Form id="companies-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/companies">
        <div className="relative max-w-[320px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" placeholder="Search by code or name…" defaultValue={params.q} className="pl-8" />
        </div>
        <select name="websiteCode" defaultValue={params.websiteCode ?? ''} className={nativeSelectClass}>
          <option value="">All websites</option>
          {websites.map((w) => (
            <option key={w.code} value={w.code}>
              {w.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {COMPANY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/companies" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <CompaniesTable companies={list.companies} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.companies.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + list.companies.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link
              href={`/companies${buildQuery({ page: page - 1, websiteCode: params.websiteCode, status: params.status, q: params.q })}`}
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
              href={`/companies${buildQuery({ page: page + 1, websiteCode: params.websiteCode, status: params.status, q: params.q })}`}
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
