import { randomBytes } from 'node:crypto';

// Excludes visually-ambiguous characters (0/O, 1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/** A short, shareable referral code — not a bearer-redeemable secret like a gift card code (no HMAC hashing needed); collisions are handled by the repository retrying against the DB unique constraint. */
export function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}
