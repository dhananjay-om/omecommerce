import 'server-only';
import { getSession } from './session';
import { ApiError } from './api-client';

/**
 * getSession() only proves a session COOKIE exists, not that the token is
 * still valid — most pages that use this (checkout, /cart) aren't gated
 * behind requireSession() the way /account/* is, so a stale/expired cookie
 * reaches them routinely. session.ts's own header comment promises that
 * case "fails 401s gracefully" — every "nice to have" signed-in-only read
 * (credit-line preview, address-book prefill, account email, wallet
 * balance, ...) must honor that instead of crashing the whole page over it.
 *
 * Lives in its own file rather than session.ts or api-client.ts to avoid a
 * circular import — api-client.ts already imports getSession from
 * session.ts, so a session.ts -> api-client.ts import back would cycle.
 */
export async function loadForSignedInShopper<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  if (!(await getSession())) return fallback;
  try {
    return await loader();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return fallback;
    throw err;
  }
}
