import { apiGet } from '@/lib/api-client';
import type { OrderHistoryEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function OrderHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await apiGet<OrderHistoryEntry[]>(`/admin/v1/orders/${id}/history`);

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">Comments History</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                <div>
                  <div className="font-medium">{h.message ?? h.eventType}</div>
                  <div className="text-xs text-muted-foreground">{h.actorType === 'ADMIN' && h.actorName ? h.actorName : h.actorType}</div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString('en-US')}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
