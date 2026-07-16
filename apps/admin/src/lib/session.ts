import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SESSION_COOKIE = 'ome_admin_token';
const SESSION_MAX_AGE_SECONDS = 60 * 60; // matches the backend JWT's own expiry (jwt-token.service.ts's TOKEN_TTL = '1h')

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

/** Read-only — safe from Server Components too. Returns null if not logged in. */
export async function getSession(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * The actual enforcement point — call this from every data-fetching function
 * (api-client.ts), not just once in a shared layout. Per Next.js's own
 * authentication guide: layouts don't re-render on client-side navigation
 * (partial rendering), so a layout-only redirect check can be skipped on
 * later navigations within the same session tree. Checking in the data
 * access layer itself (here, effectively api-client.ts's call site) means
 * the check runs on every real request instead.
 */
export async function requireSession(): Promise<string> {
  const token = await getSession();
  if (!token) {
    redirect('/login');
  }
  return token;
}
