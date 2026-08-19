import { toMinorUnits } from '../../../shared/domain/decimal.js';

/** Admin-configured wallet-tender rules for one website (plan/17) — mirrors Website's own
 *  walletEnabled/walletMaxPercentOfOrder/walletMinOrderValue/walletMaxAmountPerOrder columns. */
export interface WalletSettings {
  walletEnabled: boolean;
  walletMaxPercentOfOrder: string | null;
  walletMinOrderValue: string | null;
  walletMaxAmountPerOrder: string | null;
}

/** No restrictions at all — used when a website lookup misses (shouldn't happen for an
 *  already-resolved websiteId, but a settings read must never be the reason checkout breaks). */
export const UNRESTRICTED_WALLET_SETTINGS: WalletSettings = {
  walletEnabled: true,
  walletMaxPercentOfOrder: null,
  walletMinOrderValue: null,
  walletMaxAmountPerOrder: null,
};

/**
 * A "hard block" reason the wallet tender isn't offered at all on this order —
 * distinct from the soft caps below, which just limit the amount rather than
 * refusing the tender outright. Applied identically at the live cart preview
 * (EnrichCartView) and real checkout (CompleteCheckout) so a shopper never
 * sees a promised amount checkout then declines to honor.
 */
export function walletBlockReason(
  orderTotalMinor: bigint,
  settings: WalletSettings,
): string | null {
  if (!settings.walletEnabled) return 'wallet payments are currently unavailable in this store';
  if (
    settings.walletMinOrderValue !== null &&
    orderTotalMinor < toMinorUnits(settings.walletMinOrderValue)
  ) {
    return `wallet can only be used on orders of at least ${settings.walletMinOrderValue}`;
  }
  return null;
}

/**
 * The most the wallet tender may cover on this order, before also being
 * bounded by available balance and what's still due — call only after
 * walletBlockReason() returns null. Exact bigint minor-unit math throughout,
 * never floating point, same discipline as every other money calculation in
 * this codebase.
 */
export function walletCapMinor(orderTotalMinor: bigint, settings: WalletSettings): bigint {
  let capMinor = orderTotalMinor;
  if (settings.walletMaxPercentOfOrder !== null) {
    // Decimal(5,2) percent, e.g. "50.00" — scaled to an integer (5000) so the
    // whole calculation stays in exact bigint arithmetic.
    const pctScaled = BigInt(Math.round(Number(settings.walletMaxPercentOfOrder) * 100));
    const pctCapMinor = (orderTotalMinor * pctScaled) / 10000n;
    if (pctCapMinor < capMinor) capMinor = pctCapMinor;
  }
  if (settings.walletMaxAmountPerOrder !== null) {
    const amtCapMinor = toMinorUnits(settings.walletMaxAmountPerOrder);
    if (amtCapMinor < capMinor) capMinor = amtCapMinor;
  }
  return capMinor < 0n ? 0n : capMinor;
}
