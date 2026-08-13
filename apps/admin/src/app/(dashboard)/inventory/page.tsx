import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Warehouse, WarehouseStockItem } from '@/lib/types';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewWarehouseDialog } from './new-warehouse-dialog';
import { AdjustStockDialog } from './adjust-stock-dialog';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string }>;
}) {
  const params = await searchParams;
  const warehouses = await apiGet<Warehouse[]>('/admin/v1/warehouses');
  const selectedCode = params.warehouse ?? warehouses[0]?.code;
  const stock = selectedCode
    ? await apiGet<WarehouseStockItem[]>(`/admin/v1/inventory/warehouses/${selectedCode}/stock`)
    : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <div className="flex items-center gap-2">
          <Link href="/inventory/warehouses" className={cn(buttonVariants({ variant: 'outline' }))}>
            Manage Warehouses
          </Link>
          <NewWarehouseDialog />
        </div>
      </div>

      {warehouses.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No warehouses yet — create one to start tracking stock.</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {warehouses.map((w) => (
              <a
                key={w.code}
                href={`/inventory?warehouse=${w.code}`}
                className={cn(buttonVariants({ variant: w.code === selectedCode ? 'default' : 'outline', size: 'sm' }))}
              >
                {w.name} ({w.code})
              </a>
            ))}
          </div>

          {selectedCode ? (
            <>
              <div className="mt-6 flex items-center justify-between">
                <h2 className="text-lg font-medium">Stock — {selectedCode}</h2>
                <AdjustStockDialog warehouseCode={selectedCode} />
              </div>

              <div className="mt-4 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>On Hand</TableHead>
                      <TableHead>Reserved</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No stock items in this warehouse yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      stock.map((item) => (
                        <TableRow key={item.variantPublicId}>
                          <TableCell className="font-medium">{item.sku}</TableCell>
                          <TableCell>{item.onHand}</TableCell>
                          <TableCell>{item.reserved}</TableCell>
                          <TableCell>{item.available}</TableCell>
                          <TableCell className="text-right">
                            <AdjustStockDialog
                              warehouseCode={selectedCode}
                              initialVariant={{ publicId: item.variantPublicId, sku: item.sku }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
