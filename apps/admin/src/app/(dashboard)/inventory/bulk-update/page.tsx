import { apiGet } from '@/lib/api-client';
import type { Warehouse } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { BulkUpdateStockForm } from './bulk-update-form';

export default async function BulkUpdateStockPage() {
  const warehouses = await apiGet<Warehouse[]>('/admin/v1/warehouses');

  return (
    <div>
      <BackLink href="/inventory" label="Back to Inventory" />
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Bulk Update Stock</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a CSV of SKU + quantity rows to set on-hand stock for many products at once — Magento-style bulk qty
        import.
      </p>

      {warehouses.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No warehouses yet — <a href="/inventory/warehouses" className="underline">create one</a> before running a bulk
          import.
        </p>
      ) : (
        <BulkUpdateStockForm warehouses={warehouses} />
      )}
    </div>
  );
}
