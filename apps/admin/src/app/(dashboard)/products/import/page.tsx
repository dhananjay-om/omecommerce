import { apiGet } from '@/lib/api-client';
import type { AttributeSet, PriceList, Warehouse } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { ProductImportForm } from './product-import-form';

export default async function ProductImportPage() {
  const [attributeSets, priceLists, warehouses] = await Promise.all([
    apiGet<AttributeSet[]>('/admin/v1/attribute-sets'),
    apiGet<PriceList[]>('/admin/v1/price-lists'),
    apiGet<Warehouse[]>('/admin/v1/warehouses'),
  ]);

  return (
    <div>
      <BackLink href="/products" label="Back to Products" />
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Import Products</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a CSV of products to create or update them by SKU at once — Magento-style Add/Update import.
      </p>

      <ProductImportForm attributeSets={attributeSets} priceLists={priceLists} warehouses={warehouses} />
    </div>
  );
}
