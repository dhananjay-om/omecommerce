import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';

/** Same-origin download proxy — see .../invoice/[invoiceId]/pdf/route.ts's header comment for the exact rationale. */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/orders/[id]/shipment/[fulfillmentId]/packing-slip'>,
): Promise<NextResponse> {
  const token = await getSession();
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const { id, fulfillmentId } = await ctx.params;
  const upstream = await fetch(`${API_BASE_URL}/admin/v1/orders/${id}/shipment/${fulfillmentId}/packing-slip`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Content-Disposition', `inline; filename="packing-slip-${fulfillmentId}.pdf"`);

  return new NextResponse(body, { status: upstream.status, headers });
}
