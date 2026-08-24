import { apiGet } from '@/lib/api-client';
import type { ProductDetail } from '@/lib/types';
import { SeoForm } from './seo-form';

export default async function ProductSeoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await apiGet<ProductDetail>(`/admin/v1/products/${id}`);

  return <SeoForm product={product} />;
}
