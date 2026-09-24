import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';

/** Same-origin CSV download proxy for the newsletter subscriber list — same
 *  reason and shape as app/api/reports/export/route.ts (a plain link can't
 *  send the Authorization header, and the session token never reaches the
 *  browser). A 403 from the backend passes straight through when the admin
 *  lacks `newsletter:manage`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getSession();
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const upstream = await fetch(`${API_BASE_URL}/admin/v1/newsletter/subscribers/export${request.nextUrl.search}`, {
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
