import { apiGet } from '@/lib/api-client';
import type { AttributeSet, AttributeSetDetail, Category, TaxClass } from '@/lib/types';
import { CreateProductForm } from './create-product-form';

export default async function NewProductPage() {
  const [attributeSets, categories, taxClasses] = await Promise.all([
    apiGet<AttributeSet[]>('/admin/v1/attribute-sets'),
    apiGet<Category[]>('/admin/v1/categories'),
    apiGet<TaxClass[]>('/admin/v1/tax-classes'),
  ]);
  const details = await Promise.all(
    attributeSets.map((s) => apiGet<AttributeSetDetail>(`/admin/v1/attribute-sets/${s.id}`)),
  );
  const attributeSetDetails: Record<string, AttributeSetDetail> = {};
  for (const d of details) attributeSetDetails[d.id] = d;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New Product</h1>
      <div className="mt-6">
        <CreateProductForm
          attributeSets={attributeSets}
          attributeSetDetails={attributeSetDetails}
          categories={categories}
          taxClasses={taxClasses}
        />
      </div>
    </div>
  );
}
