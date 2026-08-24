import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Warehouse } from '@/lib/types';
import { DotBadge } from '@/components/dot-badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { NewWarehouseDialog } from '../new-warehouse-dialog';
import { EditWarehouseDialog } from './edit-warehouse-dialog';
import { DeleteWarehouseDialog } from './delete-warehouse-dialog';

export default async function ManageWarehousesPage() {
  const warehouses = await apiGet<Warehouse[]>('/admin/v1/warehouses');

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Inventory', href: '/inventory' }, { label: 'Warehouses' }]} />
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Warehouses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {warehouses.length} location{warehouses.length === 1 ? '' : 's'} · multi-warehouse fulfillment network
          </p>
        </div>
        <NewWarehouseDialog />
      </div>

      {warehouses.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No warehouses yet — create one to start tracking stock.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => (
                <TableRow key={w.code}>
                  <TableCell className="pl-6 font-mono font-medium">{w.code}</TableCell>
                  <TableCell>{w.name}</TableCell>
                  <TableCell className="text-muted-foreground">{w.type}</TableCell>
                  <TableCell className="text-muted-foreground">{w.priority}</TableCell>
                  <TableCell>
                    <DotBadge variant={w.isActive ? 'success' : 'secondary'}>{w.isActive ? 'Active' : 'Inactive'}</DotBadge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/inventory?warehouse=${w.code}`}
                        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                      >
                        View Stock
                      </Link>
                      <EditWarehouseDialog warehouse={w} />
                      <DeleteWarehouseDialog code={w.code} name={w.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
