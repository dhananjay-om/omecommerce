export interface CartLine {
  id: string;
  variantId: string;
  qty: number;
  sku: string;
  name: string;
  price: string | null;
  imageUrl: string | null;
  lineTotal: string | null;
  /** This line's share of the applied coupon's discount — null when no coupon is
   *  applied, or when an item-targeted coupon's conditions didn't match this line. */
  discountAmount: string | null;
}

export interface Cart {
  publicId: string;
  currency: string;
  status: string;
  /** Resolved CustomerGroup display name when the cart has one (company membership,
   *  the customer's own group, or the website default), null for guests/base pricing
   *  — drives the "your company pricing is applied" summary line. */
  customerGroupName: string | null;
  lines: CartLine[];
  subtotal: string | null;
  couponCode: string | null;
  /** True when couponCode came from an eligible auto-apply coupon rather than a
   *  code the customer typed — no code was ever entered, so there's nothing to
   *  "remove" (see CouponField). */
  couponIsAutoApplied: boolean;
  discountTotal: string | null;
  couponError: string | null;
  estimatedTotal: string | null;
  /** When true, every line price/subtotal above already includes GST — the final price. */
  pricesIncludeTax: boolean;
  /** Estimated GST across the cart — the real amount, just without the final
   *  CGST/SGST-vs-IGST split/labels checkout shows once the shipping state is
   *  known. Null when the cart has no priced lines yet. */
  taxTotal: string | null;
  /** Live-computed wallet/gift-card tenders — never a persisted amount, same
   *  "computed, not stored" shape as discountTotal. */
  tenders: CartTender[];
  /** estimatedTotal minus every tender's appliedAmount — what's still due
   *  before shipping (only known at checkout). Equals estimatedTotal when
   *  there are no tenders; null when estimatedTotal itself is null. */
  amountDue: string | null;
  /** Set instead of throwing when an applied tender is no longer valid (a
   *  disabled gift card, a frozen wallet) — same soft-fail-on-read shape as
   *  couponError; checkout re-validates for real and hard-fails there. */
  tenderError: string | null;
}

export type TenderType = 'WALLET' | 'GIFT_CARD';

export interface CartTender {
  tenderType: TenderType;
  /** Only for GIFT_CARD tenders — the applied card's last 4 digits, for display. */
  giftCardLast4: string | null;
  /** Only for GIFT_CARD tenders — the card's own publicId, the removal target
   *  (not the raw code, which is never retained past the moment it was
   *  typed to apply it). */
  giftCardPublicId: string | null;
  /** How much of amountDue this tender actually covers right now. */
  appliedAmount: string;
}
