import { apiGet } from '@/lib/api-client';
import type { AttributeSet, AttributeSetDetail, Category, ProductDetail, TaxClass } from '@/lib/types';
import { ProductOverviewForm } from './product-overview-form';

/** Overview tab — matches the mock's product-detail Overview exactly in
 *  shape (Product Information + AI Assistant panel), with the rest of
 *  this system's real editable fields (Status/Visibility/Tax/Attributes/
 *  Categories) carried below, same as the pre-tab-revamp edit page had. */
export default async function ProductOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Deduped by Next.js against the identical fetch the parent layout also
  // makes (same URL+options, same request pass) — costs no extra round trip.
  const product = await apiGet<ProductDetail>(`/admin/v1/products/${id}`);

  const [attributeSets, categories, taxClasses] = await Promise.all([
    apiGet<AttributeSet[]>('/admin/v1/attribute-sets'),
    apiGet<Category[]>('/admin/v1/categories'),
    apiGet<TaxClass[]>('/admin/v1/tax-classes'),
  ]);
  const details = await Promise.all(attributeSets.map((s) => apiGet<AttributeSetDetail>(`/admin/v1/attribute-sets/${s.id}`)));
  const attributeSetDetails: Record<string, AttributeSetDetail> = {};
  for (const d of details) attributeSetDetails[d.id] = d;

  return <ProductOverviewForm product={product} attributeSets={attributeSets} attributeSetDetails={attributeSetDetails} categories={categories} taxClasses={taxClasses} />;
}
