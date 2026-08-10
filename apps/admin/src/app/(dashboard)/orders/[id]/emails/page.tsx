import { apiGet } from '@/lib/api-client';
import type { OrderEmailLogEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmailLogCard } from '../../email-log-card';

export default async function OrderEmailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const emailLog = await apiGet<OrderEmailLogEntry[]>(`/admin/v1/orders/${id}/email-log`);

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">Email History</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <EmailLogCard log={emailLog} />
      </CardContent>
    </Card>
  );
}
