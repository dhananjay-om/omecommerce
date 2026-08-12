import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4100';

/**
 * Same-origin download proxy (plan/15 Phase 12) — same rationale as the
 * admin app's invoice-PDF proxy: the backend route requires a Bearer token
 * this app never exposes to the browser, and it 302s to a presigned S3/MinIO
 * URL that `fetch` follows automatically before this streams the final PDF
 * bytes through.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/account/orders/[id]/invoice'>): Promise<NextResponse> {
  const token = await getSession();
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await ctx.params;
  const upstream = await fetch(`${API_BASE_URL}/store/v1/me/orders/${id}/invoice`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Content-Disposition', `inline; filename="invoice-order-${id}.pdf"`);

  return new NextResponse(body, { status: upstream.status, headers });
}
