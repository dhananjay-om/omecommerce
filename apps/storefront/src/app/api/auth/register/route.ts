import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { createSession, getCartId } from '@/lib/session';
import { getSelectedWebsiteCode } from '@/lib/store-context';

/** Registers a new customer, then immediately logs them in (the backend's register endpoint returns the customer record but no token — one extra call keeps the UX to a single "Create account" submit). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const firstName = typeof body?.firstName === 'string' ? body.firstName : undefined;
  const lastName = typeof body?.lastName === 'string' ? body.lastName : undefined;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  try {
    const websiteCode = await getSelectedWebsiteCode();
    await apiPost('/store/v1/customers', { websiteCode, email, password, firstName, lastName });
    const login = await apiPost<{ token: string }>('/store/v1/customers/actions/login', { websiteCode, email, password });
    await createSession(login.token);

    // plan/15 Phase 6 — same non-fatal guest-cart claim as the login route.
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
