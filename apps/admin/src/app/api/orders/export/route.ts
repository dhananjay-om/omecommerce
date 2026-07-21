import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';

/**
 * Same-origin download proxy (plan/15 Phase 5) — a plain `<a href>` can't
 * attach the Authorization header the backend's `/admin/v1/orders/export`
 * requires, and this admin app never exposes the raw session token to the
 * browser (httpOnly cookie only, same convention as every Server Component
 * data fetch in lib/api-client.ts). This route reads the cookie server-side
 * and streams the backend's response straight through.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getSession();
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const upstream = await fetch(`${API_BASE_URL}/admin/v1/orders/export${request.nextUrl.search}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  const contentDisposition = upstream.headers.get('content-disposition');
  if (contentType) headers.set('Content-Type', contentType);
  if (contentDisposition) headers.set('Content-Disposition', contentDisposition);

  return new NextResponse(body, { status: upstream.status, headers });
}
