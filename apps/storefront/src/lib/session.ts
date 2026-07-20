import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SESSION_COOKIE = 'ome_storefront_token';
const CART_COOKIE = 'ome_cart_id';
// The backend customer JWT has no fixed TTL documented (no refresh flow yet —
// see the customer module's own header comment); match this app's cookie
// lifetime to a generous 30 days rather than the token's actual (undocumented)
// expiry, so a stale cookie just starts failing 401s gracefully rather than
// silently expiring the UI's "logged in" state early.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const CART_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Server Action / Route Handler only — cookies can't be set during render. */
export async function createSession(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Server Action / Route Handler only. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Read-only — safe from Server Components too. Returns null if not logged in (most storefront pages work fine logged-out, unlike the admin app). */
export async function getSession(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Unlike admin (where every page requires login, so every fetch calls this),
 * most of the storefront works fine logged out — only account-scoped pages
 * (`/account/*`) need to redirect. Call this from those pages specifically,
 * not from the shared data-fetching layer.
 */
export async function requireSession(): Promise<string> {
  const token = await getSession();
  if (!token) redirect('/login');
  return token;
}

/**
 * Guest (and logged-in) cart id — deliberately NOT httpOnly, since the
 * Zustand cartStore needs to read it client-side to know which cart to
 * fetch/mutate. It's just an opaque cart publicId, not a credential.
 */
export async function getCartId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export async function setCartId(cartPublicId: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, cartPublicId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CART_MAX_AGE_SECONDS,
  });
}
