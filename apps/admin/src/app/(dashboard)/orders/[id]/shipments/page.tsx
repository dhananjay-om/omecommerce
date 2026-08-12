import { apiGet } from '@/lib/api-client';
import type { OrderDetail } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShipmentsCard } from '../../shipments-card';

export default async function OrderShipmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiGet<OrderDetail>(`/admin/v1/orders/${id}`);

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">Shipments</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ShipmentsCard orderPublicId={order.publicId} fulfillments={order.fulfillments} />
      </CardContent>
    </Card>
  );
}
