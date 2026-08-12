import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { apiGet, ApiError } from '@/lib/api-client';
import type { Customer } from '@/types/customer';

/** Client Components (the header) hydrate login state from this — never the raw token, just the display-safe bits. */
export async function GET() {
  const token = await getSession();
  if (!token) return NextResponse.json({ isLoggedIn: false });

  try {
    const customer = await apiGet<Customer>('/store/v1/me', { auth: true });
    return NextResponse.json({ isLoggedIn: true, firstName: customer.firstName });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return NextResponse.json({ isLoggedIn: false });
    throw err;
  }
}
