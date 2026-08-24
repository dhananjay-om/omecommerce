import { apiGet } from '@/lib/api-client';
import type { ProductDetail, VariantPrice } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PricingSection } from '../edit/pricing-inventory-section';

export default async function ProductPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await apiGet<ProductDetail>(`/admin/v1/products/${id}`);

  const entries = await Promise.all(
    product.variants.map(async (variant) => ({
      variant,
      prices: await apiGet<VariantPrice[]>(`/admin/v1/variants/${variant.publicId}/prices`),
    })),
  );

  return (
    <Card>
      <CardContent className="space-y-8 pt-6">
        {entries.map(({ variant, prices }, i) => (
          <div key={variant.publicId} className={i > 0 ? 'border-t pt-8' : undefined}>
            {entries.length > 1 ? (
              <div className="mb-4 flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{variant.sku}</span>
                {variant.axisValues.map((a) => (
                  <Badge key={a.attributeCode} variant="outline">
                    {a.attributeLabel}: {a.optionLabel}
                  </Badge>
                ))}
              </div>
            ) : null}
            <PricingSection productPublicId={product.publicId} variantId={variant.publicId} prices={prices} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
