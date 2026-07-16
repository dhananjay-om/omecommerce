import { apiGet } from '@/lib/api-client';
import type { AttributeSet } from '@/lib/types';
import { CreateProductForm } from './create-product-form';

export default async function NewProductPage() {
  const attributeSets = await apiGet<AttributeSet[]>('/admin/v1/attribute-sets');

  return (
    <div>
      <h1 className="text-2xl font-semibold">New Product</h1>
      <div className="mt-6">
        <CreateProductForm attributeSets={attributeSets} />
      </div>
    </div>
  );
}
