import { apiGet } from '@/lib/api-client';
import type { ProductDetail } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUploadField } from '../edit/image-upload-field';

export default async function ProductMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await apiGet<ProductDetail>(`/admin/v1/products/${id}`);

  return (
    <Card>
      <CardContent className="pt-6">
        <ImageUploadField productPublicId={product.publicId} media={product.media} />
      </CardContent>
    </Card>
  );
}
