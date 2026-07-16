import { apiGet } from '@/lib/api-client';
import type { AttributeSet, AttributeSetDetail, ProductDetail } from '@/lib/types';
import { EditProductForm } from './edit-product-form';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, attributeSets] = await Promise.all([
    apiGet<ProductDetail>(`/admin/v1/products/${id}`),
    apiGet<AttributeSet[]>('/admin/v1/attribute-sets'),
  ]);
  const details = await Promise.all(
    attributeSets.map((s) => apiGet<AttributeSetDetail>(`/admin/v1/attribute-sets/${s.id}`)),
  );
  const attributeSetDetails: Record<string, AttributeSetDetail> = {};
  for (const d of details) attributeSetDetails[d.id] = d;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
      <div className="mt-6">
        <EditProductForm product={product} attributeSets={attributeSets} attributeSetDetails={attributeSetDetails} />
      </div>
    </div>
  );
}
