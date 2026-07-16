import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { CustomerList } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const list = await apiGet<CustomerList>(
    `/admin/v1/customers${buildQuery({ page, pageSize: PAGE_SIZE, search: params.search })}`,
  );
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Customers</h1>

      <form className="mt-6 flex gap-2" action="/customers">
        <Input name="search" placeholder="Search by name or email…" defaultValue={params.search} className="max-w-sm" />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {params.search ? (
          <Link href="/customers" className={cn(buttonVariants({ variant: 'ghost' }))}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              list.customers.map((c) => (
                <TableRow key={c.publicId}>
                  <TableCell className="font-medium">
                    <Link href={`/customers/${c.publicId}`} className="hover:underline">
                      {c.email}
                    </Link>
                  </TableCell>
                  <TableCell>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {list.total} customer{list.total === 1 ? '' : 's'} · page {list.page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link
              href={`/customers${buildQuery({ page: page - 1, search: params.search })}`}
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
              href={`/customers${buildQuery({ page: page + 1, search: params.search })}`}
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
