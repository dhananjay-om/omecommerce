import { isAxiosError } from 'axios';

export interface FriendlyTenderError {
  message: string;
  /** True when the underlying cause was a 401 — the UI should offer a way to log in again, not just show the message. */
  sessionExpired: boolean;
}

/**
 * A tender action (apply/remove wallet or credit-terms) needs a still-valid
 * session — the Route Handler behind it only checks that the session COOKIE
 * exists (see session.ts's own doc comment on why that cookie deliberately
 * outlives the backend JWT's real TTL), so a stale-but-present cookie
 * reaches the backend and comes back as a raw 401 "Invalid or expired
 * token." Showing that string verbatim tells the shopper nothing useful —
 * translate it into the one thing they can actually do about it.
 */
export function friendlyTenderError(err: unknown, fallback: string): FriendlyTenderError {
  if (isAxiosError(err)) {
    if (err.response?.status === 401) {
      return { message: 'Your session has expired.', sessionExpired: true };
    }
    return { message: err.response?.data?.error ?? fallback, sessionExpired: false };
  }
  return { message: fallback, sessionExpired: false };
}
