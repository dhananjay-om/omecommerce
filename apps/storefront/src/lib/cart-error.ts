import axios from 'axios';

/** The message a cart request failed with — the server's own text when it sent
 *  one (e.g. "Only 4 in stock — you can't add more than 4."), else `fallback`.
 *  Route handlers proxy the backend's message as `{ error }`. */
export function cartErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { error?: unknown } | undefined)?.error;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

/** Instant, client-side wording for "asked for more than is in stock". */
export function stockLimitMessage(available: number): string {
  return available <= 0 ? 'Sorry, this item is out of stock.' : `Only ${available} in stock — you can't add more than ${available}.`;
}
