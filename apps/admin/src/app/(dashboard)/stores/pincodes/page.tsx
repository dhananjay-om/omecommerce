import Link from 'next/link';
import Form from 'next/form';
import { Search } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { PincodeList } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { NewPincodeDialog } from './new-pincode-dialog';
import { EditPincodeDialog } from './edit-pincode-dialog';
import { BulkAddPincodesDialog } from './bulk-add-pincodes-dialog';

const PAGE_SIZE = 20;

export default async function PincodesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; state?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const list = await apiGet<PincodeList>(
    `/admin/v1/pincodes${buildQuery({ page, pageSize: PAGE_SIZE, search: params.search, state: params.state })}`,
  );
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Stores', href: '/stores/pincodes' }, { label: 'Pincodes' }]} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Pincodes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Delivery-serviceable pincodes shown on the storefront&apos;s pincode checker — a pincode not listed
            here reads as &quot;not serviceable yet.&quot; {list.total} pincode{list.total === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex gap-2">
          <BulkAddPincodesDialog />
          <NewPincodeDialog />
        </div>
      </div>

      <Form id="pincodes-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/stores/pincodes">
        <div className="relative max-w-[320px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input key={params.search ?? ''} name="search" placeholder="Search code or city…" defaultValue={params.search} className="pl-8" />
        </div>
        <Input key={params.state ?? ''} name="state" placeholder="State" defaultValue={params.state} className="max-w-[180px]" />
        <Button type="submit" size="sm">
          Apply
        </Button>
        {params.search || params.state ? (
          <Link href="/stores/pincodes" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Est. Days</TableHead>
              <TableHead>COD</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.pincodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No pincodes yet — the storefront checker will show every pincode as unserviceable until you add
                  some.
                </TableCell>
              </TableRow>
            ) : (
              list.pincodes.map((p) => (
                <TableRow key={p.publicId}>
                  <TableCell className="font-medium">{p.code}</TableCell>
                  <TableCell>{p.city}</TableCell>
                  <TableCell>{p.state}</TableCell>
                  <TableCell>{p.estimatedDays}</TableCell>
                  <TableCell>{p.codAvailable ? 'Available' : 'Not available'}</TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? 'success' : 'secondary'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <EditPincodeDialog pincode={p} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.pincodes.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + list.pincodes.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link
              href={`/stores/pincodes${buildQuery({ page: page - 1, search: params.search, state: params.state })}`}
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
              href={`/stores/pincodes${buildQuery({ page: page + 1, search: params.search, state: params.state })}`}
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
