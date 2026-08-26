export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

/** Mirrors the backend's OfferView (coupon/application/dto.ts) — only real,
 *  currently-active coupons that actually apply to this product (via
 *  Coupon/CouponCondition targeting), never a fabricated bank/card offer. */
export interface ProductOffer {
  code: string | null;
  description: string | null;
  discountType: CouponDiscountType;
  value: string;
  currency: string | null;
  minSubtotal: string | null;
  isAutoApply: boolean;
}
