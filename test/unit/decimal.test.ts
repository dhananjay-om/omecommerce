import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  addMinor,
  multiplyByQty,
  applyRate,
  allocateProportionally,
  extractTaxExclusive,
} from '../../src/shared/domain/decimal.js';
import { ValidationError } from '../../src/shared/domain/errors.js';

describe('decimal (fixed-point money arithmetic)', () => {
  it('round-trips a plain decimal string', () => {
    expect(fromMinorUnits(toMinorUnits('19.99'))).toBe('19.9900');
    expect(fromMinorUnits(toMinorUnits('100'))).toBe('100.0000');
    expect(fromMinorUnits(toMinorUnits('0'))).toBe('0.0000');
  });

  it('handles negative amounts (refunds/corrections)', () => {
    expect(fromMinorUnits(toMinorUnits('-5.00'))).toBe('-5.0000');
  });

  it('rejects invalid decimal strings', () => {
    expect(() => toMinorUnits('abc')).toThrow(ValidationError);
    expect(() => toMinorUnits('1.23456')).toThrow(ValidationError);
  });

  it('adds without floating-point error (the classic 0.1+0.2 trap)', () => {
    const sum = addMinor(toMinorUnits('0.10'), toMinorUnits('0.20'));
    expect(fromMinorUnits(sum)).toBe('0.3000');
  });

  it('multiplies price by an integer quantity exactly', () => {
    const lineTotal = multiplyByQty(toMinorUnits('19.99'), 3);
    expect(fromMinorUnits(lineTotal)).toBe('59.9700');
  });

  it('applies a tax rate fraction correctly', () => {
    // 100.00 at 8.25% -> 8.2500
    const tax = applyRate(toMinorUnits('100.00'), toMinorUnits('0.0825'));
    expect(fromMinorUnits(tax)).toBe('8.2500');
  });

  it('truncates sub-unit remainders on rate application (documented rounding rule)', () => {
    // 1.0001 * 0.5000 = 0.50005 precisely -> truncates to 0.5000 (round-half-up would give 0.5001)
    const result = applyRate(toMinorUnits('1.0001'), toMinorUnits('0.5000'));
    expect(fromMinorUnits(result)).toBe('0.5000');
  });
});

describe('allocateProportionally (coupon/invoice line-level discount split)', () => {
  it('splits evenly when bases are equal', () => {
    const result = allocateProportionally(toMinorUnits('10.00'), [
      { key: 'a', baseMinor: toMinorUnits('50.00') },
      { key: 'b', baseMinor: toMinorUnits('50.00') },
    ]);
    expect(fromMinorUnits(result.get('a')!)).toBe('5.0000');
    expect(fromMinorUnits(result.get('b')!)).toBe('5.0000');
  });

  it('splits by proportional share and the parts sum back to exactly the total (largest-remainder method)', () => {
    // 10.00 split 1:2 across three equal-weight lines that don't divide evenly:
    // 10.00 / 3 = 3.3333... per line naive-floor would total 9.9999, losing a minor unit.
    const result = allocateProportionally(toMinorUnits('10.00'), [
      { key: 'a', baseMinor: toMinorUnits('10.00') },
      { key: 'b', baseMinor: toMinorUnits('10.00') },
      { key: 'c', baseMinor: toMinorUnits('10.00') },
    ]);
    const total = addMinor(result.get('a')!, result.get('b')!, result.get('c')!);
    expect(total).toBe(toMinorUnits('10.00'));
    // Largest-remainder distributes the leftover minor unit(s) rather than
    // dropping them — every entry gets close to an equal share.
    for (const v of result.values()) {
      expect(fromMinorUnits(v)).toMatch(/^3\.33(33|34)$/);
    }
  });

  it('gives entries with a zero or negative base nothing, and the rest the full amount', () => {
    const result = allocateProportionally(toMinorUnits('10.00'), [
      { key: 'a', baseMinor: toMinorUnits('20.00') },
      { key: 'zero', baseMinor: 0n },
      { key: 'negative', baseMinor: -100n },
    ]);
    expect(fromMinorUnits(result.get('a')!)).toBe('10.0000');
    expect(result.get('zero')).toBe(0n);
    expect(result.get('negative')).toBe(0n);
  });

  it('returns an all-zero map without dividing by zero when every base is zero', () => {
    const result = allocateProportionally(toMinorUnits('10.00'), [
      { key: 'a', baseMinor: 0n },
      { key: 'b', baseMinor: 0n },
    ]);
    expect(result.get('a')).toBe(0n);
    expect(result.get('b')).toBe(0n);
  });

  it('returns an all-zero map when totalMinor is zero', () => {
    const result = allocateProportionally(0n, [{ key: 'a', baseMinor: toMinorUnits('10.00') }]);
    expect(result.get('a')).toBe(0n);
  });
});

describe('extractTaxExclusive (tax-inclusive catalog price -> exact taxable base + tax)', () => {
  it('backs a clean rate out of an inclusive amount exactly', () => {
    // 118.00 inclusive at 18% GST -> 100.00 exclusive + 18.00 tax, no remainder.
    const { exclusiveMinor, taxMinor } = extractTaxExclusive(toMinorUnits('118.00'), toMinorUnits('0.1800'));
    expect(fromMinorUnits(exclusiveMinor)).toBe('100.0000');
    expect(fromMinorUnits(taxMinor)).toBe('18.0000');
  });

  it('always sums back to exactly the original inclusive amount, even with an odd remainder', () => {
    // 1299.00 inclusive at 18% GST doesn't divide evenly (1100.8474... repeating).
    const { exclusiveMinor, taxMinor } = extractTaxExclusive(toMinorUnits('1299.00'), toMinorUnits('0.1800'));
    expect(fromMinorUnits(exclusiveMinor)).toBe('1100.8474');
    expect(fromMinorUnits(taxMinor)).toBe('198.1526');
    // The whole point: exclusive + tax === inclusive exactly, no minor unit gained or lost —
    // unlike computing tax independently via applyRate, which would NOT sum back exactly.
    expect(addMinor(exclusiveMinor, taxMinor)).toBe(toMinorUnits('1299.00'));
  });

  it('the smallest possible unit still sums back exactly (all-or-nothing split, no fractional loss)', () => {
    const { exclusiveMinor, taxMinor } = extractTaxExclusive(toMinorUnits('0.0001'), toMinorUnits('0.1800'));
    expect(addMinor(exclusiveMinor, taxMinor)).toBe(toMinorUnits('0.0001'));
  });

  it('a zero rate (or no tax class) passes the inclusive amount through unchanged, with zero tax', () => {
    const { exclusiveMinor, taxMinor } = extractTaxExclusive(toMinorUnits('100.00'), 0n);
    expect(fromMinorUnits(exclusiveMinor)).toBe('100.0000');
    expect(taxMinor).toBe(0n);
  });

  it('a zero inclusive amount extracts to zero/zero regardless of rate', () => {
    const { exclusiveMinor, taxMinor } = extractTaxExclusive(0n, toMinorUnits('0.1800'));
    expect(exclusiveMinor).toBe(0n);
    expect(taxMinor).toBe(0n);
  });
});
