import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';

/**
 * Same-origin download proxy for the Report Builder — mirrors
 * app/api/orders/export/route.ts exactly. A plain `<a href>` can't attach
 * the Authorization header the backend's `/admin/v1/analytics/reports/export`
 * requires, and this admin app never exposes the raw session token to the
 * browser (httpOnly cookie only). This route reads the cookie server-side
 * and streams the backend's response straight through — including a 403 when
 * the signed-in admin lacks the separate `reports:export` permission.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getSession();
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const upstream = await fetch(`${API_BASE_URL}/admin/v1/analytics/reports/export${request.nextUrl.search}`, {
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
