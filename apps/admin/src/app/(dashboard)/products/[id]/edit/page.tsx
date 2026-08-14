import { apiGet } from '@/lib/api-client';
import type { AttributeSet, AttributeSetDetail, Category, ProductDetail, TaxClass, Variant, VariantPrice, VariantStock } from '@/lib/types';
import { EditProductForm } from './edit-product-form';

export interface VariantPricingEntry {
  variant: Variant;
  prices: VariantPrice[];
  stock: VariantStock[];
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, attributeSets, categories, taxClasses] = await Promise.all([
    apiGet<ProductDetail>(`/admin/v1/products/${id}`),
    apiGet<AttributeSet[]>('/admin/v1/attribute-sets'),
    apiGet<Category[]>('/admin/v1/categories'),
    apiGet<TaxClass[]>('/admin/v1/tax-classes'),
  ]);
  const details = await Promise.all(
    attributeSets.map((s) => apiGet<AttributeSetDetail>(`/admin/v1/attribute-sets/${s.id}`)),
  );
  const attributeSetDetails: Record<string, AttributeSetDetail> = {};
  for (const d of details) attributeSetDetails[d.id] = d;

  // Pricing & Inventory are variant-scoped, not product-scoped. SIMPLE/DIGITAL/VIRTUAL products
  // have exactly one implicit variant sharing the product's own SKU; CONFIGURABLE products can
  // have any number of generated variants (Size/Color combinations) — either way, every variant
  // the product currently has gets its own Pricing & Inventory block.
  const variantPricing: VariantPricingEntry[] = await Promise.all(
    product.variants.map(async (variant) => {
      const [prices, stock] = await Promise.all([
        apiGet<VariantPrice[]>(`/admin/v1/variants/${variant.publicId}/prices`),
        apiGet<VariantStock[]>(`/admin/v1/variants/${variant.publicId}/stock`),
      ]);
      return { variant, prices, stock };
    }),
  );

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
      <div className="mt-6">
        <EditProductForm
          product={product}
          attributeSets={attributeSets}
          attributeSetDetails={attributeSetDetails}
          categories={categories}
          taxClasses={taxClasses}
          variantPricing={variantPricing}
        />
      </div>
    </div>
  );
}
