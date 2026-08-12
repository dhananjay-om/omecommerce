import { ValidationError } from './errors.js';

/**
 * Fixed-point decimal arithmetic on strings, matching NUMERIC(18,4) columns
 * (plan/00-master-plan.md §4.5: "money is never a float"). All amounts are
 * represented as minor-unit BigInts at SCALE decimal places internally, so
 * addition/multiplication never touches floating point.
 */
export const SCALE = 4;
const SCALE_FACTOR = 10n ** BigInt(SCALE);

/** Parses a decimal string ("19.99", "19.9900", "0") into scale-4 minor units. */
export function toMinorUnits(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(value.trim());
  if (!match) {
    throw new ValidationError(`invalid decimal amount: "${value}"`, [{ path: 'amount', message: 'invalid decimal' }]);
  }
  const [, sign, whole, frac = ''] = match;
  const paddedFrac = frac.padEnd(SCALE, '0');
  // whole is guaranteed by the regex's mandatory \d+ group whenever match succeeds.
  const minor = BigInt(whole!) * SCALE_FACTOR + BigInt(paddedFrac || '0');
  return sign === '-' ? -minor : minor;
}

/** Formats scale-4 minor units back to a fixed "X.XXXX" string. */
export function fromMinorUnits(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / SCALE_FACTOR;
  const frac = (abs % SCALE_FACTOR).toString().padStart(SCALE, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

export function addMinor(...values: bigint[]): bigint {
  return values.reduce((sum, v) => sum + v, 0n);
}

export function subtractMinor(a: bigint, b: bigint): bigint {
  return a - b;
}

/** price (scale-4 minor units) x integer quantity. */
export function multiplyByQty(priceMinor: bigint, qty: number): bigint {
  return priceMinor * BigInt(qty);
}

/**
 * Applies a tax/rate fraction (e.g. "0.0825" for 8.25%), itself stored at scale-4,
 * to an amount (also scale-4). Truncates (floors) toward zero on the sub-unit
 * remainder — a documented, simple rounding rule; not banker's rounding.
 */
export function applyRate(amountMinor: bigint, rateMinor: bigint): bigint {
  return (amountMinor * rateMinor) / SCALE_FACTOR;
}

export function isNegative(minor: bigint): boolean {
  return minor < 0n;
}
