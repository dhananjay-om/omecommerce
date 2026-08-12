import type { OrderFulfillment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';

export function ShipmentsCard({ orderPublicId, fulfillments }: { orderPublicId: string; fulfillments: OrderFulfillment[] }) {
  if (fulfillments.length === 0) {
    return <p className="text-sm text-muted-foreground">No shipments yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {fulfillments.map((f) => (
        <li key={f.publicId} className="space-y-1 border-b pb-3 text-sm last:border-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(f.status)}>{f.status}</Badge>
            <span className="text-muted-foreground">Shipment {f.publicId.slice(0, 8)}</span>
            <span className="text-muted-foreground">· {new Date(f.createdAt).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {f.carrier ? (
              <div>
                <span className="text-muted-foreground">Carrier: </span>
                {f.carrier}
              </div>
            ) : null}
            {f.trackingNumber ? (
              <div>
                <span className="text-muted-foreground">Tracking: </span>
                {f.carrierTrackingUrl ? (
                  <a href={f.carrierTrackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {f.trackingNumber}
                  </a>
                ) : (
                  f.trackingNumber
                )}
              </div>
            ) : null}
            {f.estimatedDeliveryAt ? (
              <div>
                <span className="text-muted-foreground">ETA: </span>
                {new Date(f.estimatedDeliveryAt).toLocaleDateString('en-US')}
              </div>
            ) : null}
            {f.currentStatus ? (
              <div>
                <span className="text-muted-foreground">Carrier status: </span>
                {f.currentStatus}
              </div>
            ) : null}
          </div>
          {f.shippingNotes ? <p className="text-muted-foreground">{f.shippingNotes}</p> : null}
          {f.hasPackingSlip ? (
            <a
              href={`/api/orders/${orderPublicId}/shipment/${f.publicId}/packing-slip`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-primary hover:underline"
            >
              Download Packing Slip
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
