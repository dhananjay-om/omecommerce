import { describe, it, expect } from 'vitest';
import { splitGst } from '../../src/modules/order/domain/gst.js';
import { toMinorUnits, fromMinorUnits, addMinor } from '../../src/shared/domain/decimal.js';

describe('splitGst (India GST — CGST/SGST vs IGST)', () => {
  it('intra-state (same origin/destination state): splits into CGST + SGST, each half the rate', () => {
    const rateMinor = toMinorUnits('0.1800'); // 18%
    const amountMinor = toMinorUnits('18.00'); // 18% of 100
    const breakdown = splitGst(rateMinor, amountMinor, '27', '27');

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]).toMatchObject({ type: 'CGST', rateMinor: toMinorUnits('0.0900') });
    expect(breakdown[1]).toMatchObject({ type: 'SGST', rateMinor: toMinorUnits('0.0900') });
    expect(fromMinorUnits(breakdown[0]!.amountMinor)).toBe('9.0000');
    expect(fromMinorUnits(breakdown[1]!.amountMinor)).toBe('9.0000');
    // Always sums back to exactly the input amount — the whole point of using
    // allocateProportionally instead of naive floor division.
    expect(addMinor(breakdown[0]!.amountMinor, breakdown[1]!.amountMinor)).toBe(amountMinor);
  });

  it('intra-state with an odd-paisa amount: CGST+SGST still sum back exactly (largest-remainder split)', () => {
    const rateMinor = toMinorUnits('0.1800');
    const amountMinor = toMinorUnits('0.0001'); // smallest possible unit, can't be halved evenly
    const breakdown = splitGst(rateMinor, amountMinor, '27', '27');
    expect(addMinor(breakdown[0]!.amountMinor, breakdown[1]!.amountMinor)).toBe(amountMinor);
    // One side gets the leftover unit, the other gets 0 — never lost, never duplicated.
    const amounts = breakdown.map((b) => b.amountMinor).sort();
    expect(amounts).toEqual([0n, amountMinor]);
  });

  it('inter-state (different states): a single IGST entry at the full rate', () => {
    const rateMinor = toMinorUnits('0.1800');
    const amountMinor = toMinorUnits('18.00');
    const breakdown = splitGst(rateMinor, amountMinor, '27', '07');

    expect(breakdown).toEqual([{ type: 'IGST', rateMinor, amountMinor }]);
  });

  it('unknown/missing destination state: treated as inter-state (documented safer default)', () => {
    const rateMinor = toMinorUnits('0.1800');
    const amountMinor = toMinorUnits('18.00');
    expect(splitGst(rateMinor, amountMinor, '27', null)).toEqual([{ type: 'IGST', rateMinor, amountMinor }]);
  });

  it('unknown origin state (e.g. Website.originStateCode never configured): also treated as inter-state', () => {
    const rateMinor = toMinorUnits('0.1800');
    const amountMinor = toMinorUnits('18.00');
    expect(splitGst(rateMinor, amountMinor, null, '27')).toEqual([{ type: 'IGST', rateMinor, amountMinor }]);
  });

  it('zero tax amount (no tax class, or a 0% class): returns an empty breakdown, nothing to split', () => {
    expect(splitGst(0n, 0n, '27', '27')).toEqual([]);
    expect(splitGst(0n, 0n, '27', '07')).toEqual([]);
  });
});
