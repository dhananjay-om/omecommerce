import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';

interface ReturnRequestBody {
  reason: string;
  lines: Array<{ sku: string; qty: number; restock?: boolean }>;
  refundTo?: 'ORIGINAL_PAYMENT_METHOD' | 'WALLET';
}

/** Proxies to the backend's ownership-checked return route
 *  (POST /store/v1/me/orders/:id/returns — CreateCustomerReturn, which
 *  delegates to the same CreateReturn usecase an admin's own "Create
 *  Return" dialog uses). This only ever creates a REQUESTED return — it
 *  still goes through the same admin-moderated Approve -> Receive ->
 *  Refund pipeline as an admin-logged one, not an instant refund. */
export async function POST(request: Request, ctx: RouteContext<'/api/account/orders/[id]/return'>): Promise<NextResponse> {
  const { id } = await ctx.params;
  const body = (await request.json()) as ReturnRequestBody;
  try {
    const result = await apiPost<{ publicId: string }>(`/store/v1/me/orders/${id}/returns`, body, { auth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
