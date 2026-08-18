import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import type { AttachReferralResult } from '@/types/referral';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code : '';
  if (!code) return NextResponse.json({ error: 'A referral code is required.' }, { status: 400 });

  try {
    const result = await apiPost<AttachReferralResult>('/store/v1/me/referrals/actions/attach', { code }, { auth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
