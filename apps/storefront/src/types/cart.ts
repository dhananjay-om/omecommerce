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
}
