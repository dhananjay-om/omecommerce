import { formatPrice } from '@/lib/format-price';
import { cn } from '@/lib/utils';

/**
 * Presentational free-shipping progress bar, shared by the mini-cart and
 * the cart page. Per the storefront restyle plan's Decision 7: there's no
 * real free-shipping-threshold setting anywhere in this system today
 * (`ShippingMethod` is flat-rate, no spend-threshold field) — this keeps a
 * hardcoded threshold constant, same posture as the announcement bar's own
 * pre-existing hardcoded "Free shipping on orders over $50" copy, just
 * made currency-aware instead of always assuming USD. If a real threshold
 * setting is ever added, this is a one-line swap to a real value.
 */
const THRESHOLD_BY_CURRENCY: Record<string, number> = {
  USD: 50,
  INR: 3000,
};
const DEFAULT_THRESHOLD = 50;

export function FreeShippingBar({
  subtotal,
  currency,
  className,
}: {
  subtotal: string | null;
  currency: string;
  className?: string;
}) {
  const amount = subtotal ? Number(subtotal) : 0;
  const threshold = THRESHOLD_BY_CURRENCY[currency] ?? DEFAULT_THRESHOLD;

  if (amount <= 0) return null;

  if (amount >= threshold) {
    return (
      <div className={cn('rounded-2xl border border-champagne/30 bg-champagne/10 px-4 py-2.5 text-center', className)}>
        <p className="text-xs font-medium text-champagne">🎉 You&apos;ve unlocked free shipping!</p>
      </div>
    );
  }

  const remaining = threshold - amount;
  const pct = Math.min((amount / threshold) * 100, 100);

  return (
    <div className={cn('rounded-2xl border border-ghost bg-ivory p-4', className)}>
      <div className="mb-1.5 flex justify-between text-xs text-slate">
        <span>Add {formatPrice(String(remaining), currency)} more for free shipping</span>
        <span className="font-medium text-champagne">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-ghost">
        <div className="h-full rounded-full bg-champagne transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
