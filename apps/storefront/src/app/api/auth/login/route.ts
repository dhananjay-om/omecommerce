import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { createSession, getCartId } from '@/lib/session';
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

    // plan/15 Phase 6 — claims a pre-login guest cart and re-derives its
    // pricing group (company membership -> customer's own group -> default
    // -> null); a bad/expired/already-converted cart id must never block
    // login, same non-fatal-attach precedent as the referral-code attach.
    const cartId = await getCartId();
    if (cartId) {
      await apiPost(`/store/v1/carts/${cartId}/actions/attach-customer`, {}, { auth: true }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
