import { NextResponse } from 'next/server';
import { apiGet, ApiError } from '@/lib/api-client';
import type { PincodeCheckResult } from '@/types/pincode';

/** Proxies the public pincode-serviceability check for the PDP's client-side
 *  checker (PincodeChecker needs interactive input, so it's a Client
 *  Component — same same-origin /api/* convention as every other
 *  Client-Component fetch in this app, see lib/axios.ts's own comment). */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const result = await apiGet<PincodeCheckResult>(`/store/v1/pincodes/${code}/check`);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
