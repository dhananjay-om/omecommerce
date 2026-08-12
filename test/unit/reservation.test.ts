import { describe, it, expect } from 'vitest';
import { computeExpiry, DEFAULT_RESERVATION_TTL_SECONDS } from '../../src/modules/inventory/domain/reservation.js';

describe('reservation expiry', () => {
  it('defaults to a 15 minute hold', () => {
    expect(DEFAULT_RESERVATION_TTL_SECONDS).toBe(900);
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiry = computeExpiry(now);
    expect(expiry.getTime() - now.getTime()).toBe(900_000);
  });

  it('accepts a custom TTL', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(computeExpiry(now, 60).getTime() - now.getTime()).toBe(60_000);
  });

  it('accepts a non-positive TTL (used by tests to construct an already-expired reservation)', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiry = computeExpiry(now, -60);
    expect(expiry.getTime()).toBeLessThan(now.getTime());
  });
});
