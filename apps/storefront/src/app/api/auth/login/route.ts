import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { createSession } from '@/lib/session';
import { WEBSITE_CODE } from '@/lib/config';

/** Proxies login to the Express backend and stores the resulting JWT in an httpOnly cookie — the client never sees the token itself. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  try {
    const result = await apiPost<{ token: string; customerPublicId: string }>('/store/v1/customers/actions/login', {
      websiteCode: WEBSITE_CODE,
      email,
      password,
    });
    await createSession(result.token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
