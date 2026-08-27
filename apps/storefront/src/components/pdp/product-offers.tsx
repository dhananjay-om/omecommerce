import { TagIcon } from '@heroicons/react/24/outline';
import { getProductOffers } from '@/services/offers.service';
import { CopyCodeButton } from './copy-code-button';
import type { CouponDiscountType } from '@/types/offer';

function formatDiscount(discountType: CouponDiscountType, value: string, currency: string | null): string {
  return discountType === 'PERCENTAGE' ? `${value}% off` : `${currency ?? ''}${value} off`;
}

/**
 * Real, currently-active coupons that actually apply to this product (via
 * the same Coupon/CouponCondition targeting checkout uses) — never a
 * fabricated bank/card-style offer. Renders nothing when nothing real
 * applies, same "don't pad with nothing real" posture as this app's other
 * empty states.
 */
export async function ProductOffers({ productId }: { productId: string }) {
  const offers = await getProductOffers(productId);
  if (offers.length === 0) return null;

  return (
    <div className="rounded-xl border border-ghost p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-jet">
        <TagIcon className="size-4 text-champagne" />
        Available Offers
      </div>
      <ul className="mt-2 space-y-2.5">
        {offers.map((offer, i) => (
          <li key={offer.code ?? `auto-${i}`} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <span className="font-medium text-jet">{formatDiscount(offer.discountType, offer.value, offer.currency)}</span>
              {offer.description ? <span className="ml-1.5 text-charcoal">{offer.description}</span> : null}
              {offer.minSubtotal ? (
                <span className="block text-xs text-slate">
                  On orders above {offer.currency ?? ''}
                  {offer.minSubtotal}
                </span>
              ) : null}
            </div>
            {offer.code ? (
              <CopyCodeButton code={offer.code} />
            ) : (
              <span className="shrink-0 text-xs text-slate">Applied automatically</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
