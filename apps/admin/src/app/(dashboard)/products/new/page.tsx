import { apiGet } from '@/lib/api-client';
import type { AttributeSet, AttributeSetDetail } from '@/lib/types';
import { CreateProductForm } from './create-product-form';

export default async function NewProductPage() {
  const attributeSets = await apiGet<AttributeSet[]>('/admin/v1/attribute-sets');
  const details = await Promise.all(
    attributeSets.map((s) => apiGet<AttributeSetDetail>(`/admin/v1/attribute-sets/${s.id}`)),
  );
  const attributeSetDetails: Record<string, AttributeSetDetail> = {};
  for (const d of details) attributeSetDetails[d.id] = d;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New Product</h1>
      <div className="mt-6">
        <CreateProductForm attributeSets={attributeSets} attributeSetDetails={attributeSetDetails} />
      </div>
    </div>
  );
}
