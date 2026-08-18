import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { CompanyList, CompanyStatus, Website } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

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
  const hasFilters = !!(params.websiteCode || params.status || params.q);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
        <Link href="/companies/new" className={cn(buttonVariants())}>
          New Company
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-2" action="/companies">
        <Input name="q" placeholder="Search by code or name…" defaultValue={params.q} className="max-w-sm" />
        <select name="websiteCode" defaultValue={params.websiteCode ?? ''} className={nativeSelectClass}>
          <option value="">All Websites</option>
          {websites.map((w) => (
            <option key={w.code} value={w.code}>
              {w.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All Statuses</option>
          {COMPANY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Search
        </Button>
        {hasFilters ? (
          <Link href="/companies" className={cn(buttonVariants({ variant: 'ghost' }))}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No companies found.
                </TableCell>
              </TableRow>
            ) : (
              list.companies.map((c) => (
                <TableRow key={c.publicId}>
                  <TableCell className="font-medium">
                    <Link href={`/companies/${c.publicId}`} className="hover:underline">
                      {c.code}
                    </Link>
                  </TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Link href={`/companies/${c.publicId}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
          {list.total} compan{list.total === 1 ? 'y' : 'ies'} · page {list.page} of {totalPages}
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
