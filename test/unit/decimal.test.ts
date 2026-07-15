import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  addMinor,
  multiplyByQty,
  applyRate,
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
