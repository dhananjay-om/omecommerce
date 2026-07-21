import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCustomerOrderTracking } from '@/services/order.service';
import { ApiError } from '@/lib/api-client';

export const metadata: Metadata = { title: 'Track Your Order' };

export default async function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let tracking;
  try {
    tracking = await getCustomerOrderTracking(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <Link href={`/account/orders/${id}`} className="text-sm text-muted-foreground hover:underline">
        ← Back to Order
      </Link>
      <h2 className="mt-2 mb-4 text-lg font-semibold">Tracking</h2>

      {tracking.fulfillments.length === 0 ? (
        <p className="text-muted-foreground">This order hasn&apos;t shipped yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {tracking.fulfillments.map((f) => (
            <div key={f.publicId} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{f.status}</span>
                {f.estimatedDeliveryAt ? (
                  <span className="text-xs text-muted-foreground">Estimated delivery: {new Date(f.estimatedDeliveryAt).toLocaleDateString()}</span>
                ) : null}
              </div>
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {f.carrier ? (
                  <div>
                    <span className="text-muted-foreground">Carrier: </span>
                    {f.carrier}
                  </div>
                ) : null}
                {f.trackingNumber ? (
                  <div>
                    <span className="text-muted-foreground">Tracking #: </span>
                    {f.carrierTrackingUrl ? (
                      <a href={f.carrierTrackingUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                        {f.trackingNumber}
                      </a>
                    ) : (
                      f.trackingNumber
                    )}
                  </div>
                ) : null}
                {f.currentStatus ? (
                  <div>
                    <span className="text-muted-foreground">Carrier status: </span>
                    {f.currentStatus}
                  </div>
                ) : null}
              </div>
              {f.shippingNotes ? <p className="mt-2 text-sm text-muted-foreground">{f.shippingNotes}</p> : null}
            </div>
          ))}
        </div>
      )}

      {tracking.history.length > 0 ? (
        <div className="mt-8">
          <h3 className="mb-2 text-sm font-semibold">History</h3>
          <ul className="flex flex-col gap-2">
            {tracking.history.map((h) => (
              <li key={h.id} className="flex justify-between gap-4 border-b pb-2 text-sm last:border-0">
                <span>{h.message ?? h.eventType}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
