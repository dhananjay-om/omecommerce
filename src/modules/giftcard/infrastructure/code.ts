import { randomBytes, createHmac } from 'node:crypto';

/** High-entropy code, dash-grouped for readability (plan/10 §3.4). Never stored raw. */
export function generateGiftCardCode(): string {
  const hex = randomBytes(10).toString('hex').toUpperCase();
  return hex.match(/.{1,4}/g)!.join('-');
}

/**
 * HMAC-SHA256 with a dedicated secret (not JWT_SECRET — a different
 * cryptographic purpose, see env.ts). Deterministic so a submitted code can be
 * looked up by exact-match hash; never reversible back to the raw code.
 */
export function hashGiftCardCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code.trim().toUpperCase()).digest('hex');
}

export function last4(code: string): string {
  const alnum = code.replace(/-/g, '');
  return alnum.slice(-4);
}
