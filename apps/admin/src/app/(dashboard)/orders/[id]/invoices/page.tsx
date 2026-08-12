import { apiGet } from '@/lib/api-client';
import type { OrderDetail } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoicesCard } from '../../invoices-card';

export default async function OrderInvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiGet<OrderDetail>(`/admin/v1/orders/${id}`);

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">Invoices</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <InvoicesCard orderPublicId={order.publicId} invoices={order.invoices} currency={order.currency} />
      </CardContent>
    </Card>
  );
}
