import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Warehouse } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewWarehouseDialog } from '../new-warehouse-dialog';
import { EditWarehouseDialog } from './edit-warehouse-dialog';
import { DeleteWarehouseDialog } from './delete-warehouse-dialog';

export default async function ManageWarehousesPage() {
  const warehouses = await apiGet<Warehouse[]>('/admin/v1/warehouses');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link href="/inventory" className="text-sm text-muted-foreground hover:underline">
            ← Back to Inventory
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Manage Warehouses</h1>
        </div>
        <NewWarehouseDialog />
      </div>

      {warehouses.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No warehouses yet — create one to start tracking stock.</p>
      ) : (
        <div className="mt-6 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => (
                <TableRow key={w.code}>
                  <TableCell className="font-medium">{w.code}</TableCell>
                  <TableCell>{w.name}</TableCell>
                  <TableCell>{w.type}</TableCell>
                  <TableCell>{w.priority}</TableCell>
                  <TableCell>
                    <Badge variant={w.isActive ? 'success' : 'secondary'}>
                      {w.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
