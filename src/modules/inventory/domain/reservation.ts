/** Default reservation hold time (plan/07 §3). Configurable per call for testability. */
export const DEFAULT_RESERVATION_TTL_SECONDS = 900; // 15 minutes

export function computeExpiry(now: Date, ttlSeconds: number = DEFAULT_RESERVATION_TTL_SECONDS): Date {
  return new Date(now.getTime() + ttlSeconds * 1000);
}
