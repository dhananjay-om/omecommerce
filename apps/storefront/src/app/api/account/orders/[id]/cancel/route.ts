import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import type { OrderView } from '@/types/order';

interface CancelBody {
  reason?: string;
  refundTo?: 'ORIGINAL_PAYMENT_METHOD' | 'WALLET';
}

/** Proxies to the backend's ownership-checked cancel route
 *  (POST /store/v1/me/orders/:id/cancel — CancelCustomerOrder, which
 *  delegates to the same CancelOrder usecase the admin's own Cancel
 *  Order action uses). Same client-calls-same-origin-route-handler shape
 *  as reorder's own route. */
export async function POST(request: Request, ctx: RouteContext<'/api/account/orders/[id]/cancel'>): Promise<NextResponse> {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as CancelBody;
  try {
    const result = await apiPost<OrderView>(`/store/v1/me/orders/${id}/cancel`, body, { auth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
