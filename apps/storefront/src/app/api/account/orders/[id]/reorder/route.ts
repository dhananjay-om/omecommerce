import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { setCartId } from '@/lib/session';

interface ReorderResult {
  cartPublicId: string;
  skipped: Array<{ sku: string; name: string; reason: string }>;
}

/** plan/15 Phase 11 — proxies to the backend's ownership-checked reorder route, then points this browser's cart cookie at the freshly-created cart so the next cart read picks it up. */
export async function POST(_request: Request, ctx: RouteContext<'/api/account/orders/[id]/reorder'>): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const result = await apiPost<ReorderResult>(`/store/v1/me/orders/${id}/reorder`, undefined, { auth: true });
    await setCartId(result.cartPublicId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
