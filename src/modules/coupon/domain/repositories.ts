export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface CouponInfo {
  id: bigint;
  publicId: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  value: string;
  currency: string | null;
  minSubtotal: string | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  value: string;
  currency?: string | null;
  minSubtotal?: string | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
}

export interface UpdateCouponInput {
  description?: string | null;
  discountType?: CouponDiscountType;
  value?: string;
  currency?: string | null;
  minSubtotal?: string | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
}

/** Currency Setup (admin-facing) — Coupon Setup, same shape as WarehouseRepository/
 *  CurrencyRepository/PriceListRepository: create/list/update/soft-delete admin CRUD. */
export interface CouponRepository {
  create(input: CreateCouponInput): Promise<CouponInfo>;
  findByCode(code: string): Promise<CouponInfo | null>;
  list(): Promise<CouponInfo[]>;
  update(code: string, input: UpdateCouponInput): Promise<CouponInfo>;
  softDelete(code: string): Promise<void>;
}

export interface EvaluateCouponInput {
  code: string;
  cartCurrency: string;
  subtotalMinor: bigint;
  customerId: bigint | null;
  asOf: Date;
}

export interface CouponEvaluation {
  couponId: bigint;
  code: string;
  /** Clamped: never exceeds subtotalMinor (so a grand total can never go negative). */
  discountAmountMinor: bigint;
}

export interface RedeemCouponInput {
  couponId: bigint;
  orderId: bigint;
  customerId: bigint | null;
  /** Snapshotted onto CouponRedemption.currency — every sibling ledger row does the
   *  same (WalletTransaction/GiftCardTransaction), so a currency-mixing SUM() across
   *  redemptions is impossible. */
  currency: string;
  discountAmountMinor: bigint;
}

/**
 * The checkout/cart-facing port — defined here (not in order/domain/ports.ts) and
 * imported directly into the order module, the same split already used for
 * PriceResolver (defined in pricing/domain/repositories.ts). Read-only evaluate()
 * for cart preview + checkout's own re-validation; a separate mutating redeem()
 * only ever called once an order has actually been placed.
 */
export interface DiscountCalculator {
  /** Validates + computes; never mutates usage. Throws a typed CouponError
   *  (not-found/inactive/expired/min-subtotal/currency-mismatch/usage-limit) on
   *  any invalid coupon rather than returning null — callers decide whether to
   *  propagate (checkout) or swallow into a soft `couponError` (cart preview). */
  evaluate(input: EvaluateCouponInput): Promise<CouponEvaluation>;
  /** Guarded usage-count UPDATE + CouponRedemption insert, one DB transaction.
   *  Throws CouponUsageLimitExceededError if the guarded UPDATE affects 0 rows
   *  (the limit was hit, including a race lost against a concurrent checkout). */
  redeem(input: RedeemCouponInput): Promise<void>;
}
