import { apiGet } from '@/lib/api-client';
import type { AttributeSetDetail, ProductDetail } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { VariantsSection } from '../edit/variants-section';

export default async function ProductVariantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await apiGet<ProductDetail>(`/admin/v1/products/${id}`);

  if (product.type !== 'CONFIGURABLE') {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">This is a {product.type} product — it doesn&apos;t have variants.</CardContent>
      </Card>
    );
  }

  const setDetail = await apiGet<AttributeSetDetail>(`/admin/v1/attribute-sets/${product.attributeSetId}`);

  return (
    <Card>
      <CardContent className="pt-6">
        <VariantsSection productPublicId={product.publicId} groups={setDetail.groups} variants={product.variants} />
      </CardContent>
    </Card>
  );
}
