import { apiGet } from '@/lib/api-client';
import type { AttributeSet, AttributeSetDetail, Category, ProductDetail, VariantPrice, VariantStock } from '@/lib/types';
import { EditProductForm } from './edit-product-form';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, attributeSets, categories] = await Promise.all([
    apiGet<ProductDetail>(`/admin/v1/products/${id}`),
    apiGet<AttributeSet[]>('/admin/v1/attribute-sets'),
    apiGet<Category[]>('/admin/v1/categories'),
  ]);
  const details = await Promise.all(
    attributeSets.map((s) => apiGet<AttributeSetDetail>(`/admin/v1/attribute-sets/${s.id}`)),
  );
  const attributeSetDetails: Record<string, AttributeSetDetail> = {};
  for (const d of details) attributeSetDetails[d.id] = d;

  // Pricing & Inventory are variant-scoped, not product-scoped. SIMPLE/DIGITAL/VIRTUAL
  // products have exactly one implicit variant sharing the product's own SKU, so that
  // variant's public ID is the right target — CONFIGURABLE/BUNDLE products manage price
  // and stock per child variant elsewhere, so this section is skipped for them.
  const pricingVariant = product.variants.length === 1 ? product.variants[0] : null;
  const [variantPrices, variantStock] = pricingVariant
    ? await Promise.all([
        apiGet<VariantPrice[]>(`/admin/v1/variants/${pricingVariant.publicId}/prices`),
        apiGet<VariantStock[]>(`/admin/v1/variants/${pricingVariant.publicId}/stock`),
      ])
    : [[], []];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
      <div className="mt-6">
        <EditProductForm
          product={product}
          attributeSets={attributeSets}
          attributeSetDetails={attributeSetDetails}
          categories={categories}
          pricingVariantId={pricingVariant?.publicId ?? null}
          variantPrices={variantPrices}
          variantStock={variantStock}
        />
      </div>
    </div>
  );
}
