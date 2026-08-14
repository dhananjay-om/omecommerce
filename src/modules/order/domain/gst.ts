import { allocateProportionally } from '../../../shared/domain/decimal.js';
import type { GstTaxType } from './ports.js';

export interface GstBreakdownEntry {
  type: GstTaxType;
  rateMinor: bigint;
  amountMinor: bigint;
}

/**
 * India GST split (regular scheme, single-state-registration scope — see
 * store.prisma's Website.originStateCode doc comment). Pure function, no I/O,
 * unit-tested directly: given a line's already-computed combined tax
 * (rateMinor/amountMinor from TaxClass.rate applied to the line subtotal) plus
 * the seller's origin state and the buyer's destination state, returns the
 * CGST+SGST or IGST breakdown that sums to exactly amountMinor.
 *
 * - Intra-state (destination === origin): CGST + SGST, each half the rate —
 *   split via allocateProportionally (two equal-weight keys) so the two
 *   amounts always sum back to exactly amountMinor, not a floor-divided
 *   approximation that could lose a paisa.
 * - Inter-state (destination !== origin), OR either state is unknown: a
 *   single IGST entry at the full rate. Treating "unknown" as inter-state
 *   (rather than silently assuming intra-state) is the documented, safer
 *   default — it never under-charges CGST+SGST when the actual jurisdiction
 *   can't be confirmed. Union Territories without their own legislature are
 *   labeled SGST here too (documented simplification — see _base.prisma's
 *   GstTaxType doc comment; the rate math is identical either way).
 * - Zero amount (no tax class, or a 0% class) returns an empty breakdown —
 *   nothing to split.
 */
export function splitGst(
  rateMinor: bigint,
  amountMinor: bigint,
  originStateCode: string | null,
  destinationStateCode: string | null,
): GstBreakdownEntry[] {
  if (amountMinor === 0n) return [];

  const isIntraState = originStateCode !== null && destinationStateCode !== null && originStateCode === destinationStateCode;

  if (!isIntraState) {
    return [{ type: 'IGST', rateMinor, amountMinor }];
  }

  const split = allocateProportionally(amountMinor, [
    { key: 'CGST' as const, baseMinor: 1n },
    { key: 'SGST' as const, baseMinor: 1n },
  ]);
  const halfRateMinor = rateMinor / 2n;
  return [
    { type: 'CGST', rateMinor: halfRateMinor, amountMinor: split.get('CGST') ?? 0n },
    { type: 'SGST', rateMinor: halfRateMinor, amountMinor: split.get('SGST') ?? 0n },
  ];
}
