import { NextResponse } from 'next/server';
import { setSelectedStoreCookie } from '@/lib/store-context';
import { clearCartId } from '@/lib/session';

/**
 * Switching stores sets the `ome_store` cookie AND clears the cart — a
 * cart's currency/website is locked in permanently at creation (confirmed
 * by this session's own earlier real production bug: switching the
 * store's currency did NOT retroactively fix an already-existing cart).
 * The client reloads the page after this resolves, which re-hydrates every
 * Zustand store (cart/auth/wishlist) cleanly.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const storeViewId = typeof body?.storeViewId === 'string' ? body.storeViewId : '';
  if (!storeViewId) {
    return NextResponse.json({ error: 'storeViewId is required.' }, { status: 400 });
  }

  await setSelectedStoreCookie(storeViewId);
  await clearCartId();

  return NextResponse.json({ ok: true });
}
