import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';

/**
 * Same-origin proxy, same reasoning and shape as app/api/orders/export/route.ts
 * — the coupon condition builder's "pick a Value" dropdown needs to fetch a
 * different attribute's options every time the admin changes the Attribute
 * Select, from a Client Component that has no access to the httpOnly session
 * token. This route reads the cookie server-side and forwards the request.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }): Promise<NextResponse> {
  const token = await getSession();
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const { code } = await params;
  const upstream = await fetch(`${API_BASE_URL}/admin/v1/attributes/${encodeURIComponent(code)}/options`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const body = await upstream.text();
  return new NextResponse(body, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
}
