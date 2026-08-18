import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import type { RedeemLoyaltyPointsResult } from '@/types/loyalty';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const points = typeof body?.points === 'string' ? body.points : '';
  if (!points) return NextResponse.json({ error: 'A number of points is required.' }, { status: 400 });

  try {
    const result = await apiPost<RedeemLoyaltyPointsResult>('/store/v1/me/loyalty/actions/redeem', { points }, { auth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
