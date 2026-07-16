import { apiGet } from '@/lib/api-client';
import type { AttributeSet, ProductDetail } from '@/lib/types';
import { EditProductForm } from './edit-product-form';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, attributeSets] = await Promise.all([
    apiGet<ProductDetail>(`/admin/v1/products/${id}`),
    apiGet<AttributeSet[]>('/admin/v1/attribute-sets'),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
      <div className="mt-6">
        <EditProductForm product={product} attributeSets={attributeSets} />
      </div>
    </div>
  );
}
