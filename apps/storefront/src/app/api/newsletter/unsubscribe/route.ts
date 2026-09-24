import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!token) return NextResponse.json({ error: 'This unsubscribe link is invalid.' }, { status: 400 });
  try {
    await apiPost('/store/v1/newsletter/unsubscribe', { token });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      const message = err.status === 404 || err.status === 422 ? 'This unsubscribe link is invalid or has expired.' : 'Could not unsubscribe right now. Please try again.';
      return NextResponse.json({ error: message }, { status: err.status === 404 || err.status === 422 ? 404 : 502 });
    }
    throw err;
  }
}
