export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CouponTargetType = 'CART' | 'ITEM';
export type CouponConditionType = 'PRODUCT' | 'CATEGORY' | 'ATTRIBUTE';

export interface CouponConditionInfo {
  conditionType: CouponConditionType;
  productId: bigint | null;
  categoryId: bigint | null;
  attributeId: bigint | null;
  attributeValue: string | null;
}

/** Shape submitted by the admin (create/update) — same fields as CouponConditionInfo
 *  minus the nulls the caller doesn't need to spell out for its own conditionType. */
export interface CreateCouponConditionInput {
  conditionType: CouponConditionType;
  productId?: bigint;
  categoryId?: bigint;
  attributeId?: bigint;
  attributeValue?: string;
}

export interface CouponInfo {
  id: bigint;
  publicId: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  value: string;
  currency: string | null;
  minSubtotal: string | null;
  targetType: CouponTargetType;
  isAutoApply: boolean;
  conditions: CouponConditionInfo[];
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
  targetType?: CouponTargetType;
  isAutoApply?: boolean;
  /** Required (>=1) iff targetType='ITEM', forbidden iff targetType='CART' —
   *  app-validated in create-coupon.usecase.ts, DB-enforced by the deferred
   *  constraint triggers in the coupon_targeting migration. */
  conditions?: CreateCouponConditionInput[];
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
  targetType?: CouponTargetType;
  isAutoApply?: boolean;
  /** When provided, replaces the coupon's entire condition set wholesale
   *  (delete-and-recreate in the same transaction as the field update) —
   *  simplest correct approach for a small, admin-authored config list. */
  conditions?: CreateCouponConditionInput[];
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
}

// --- Cross-module read-only lookups (each module resolves its own dependencies,
// same convention as order/pricing/search's own XxxLookup ports — never importing
// catalog's domain repositories wholesale). Used only by CreateCoupon/UpdateCoupon
// to translate the admin's publicId/code-based condition input into the internal
// bigint ids CouponCondition actually stores, and to resolve those ids back to
// display-friendly labels for CouponView. ---

export interface ProductLookup {
  byPublicId(publicId: string): Promise<{ id: bigint } | null>;
  byId(id: bigint): Promise<{ publicId: string; name: string | null } | null>;
}

export interface CategoryLookup {
  byPublicId(publicId: string): Promise<{ id: bigint } | null>;
  byId(id: bigint): Promise<{ publicId: string; name: string | null } | null>;
}

export interface AttributeLookup {
  byCode(code: string): Promise<{ id: bigint; dataType: string } | null>;
  byId(id: bigint): Promise<{ code: string; label: string; dataType: string } | null>;
  /** For SELECT/MULTISELECT attributes, the human label of one AttributeOption
   *  (whose id is what CouponCondition.attributeValue stores as a string for
   *  those data types) — null for non-option-backed data types or an unknown id. */
  optionLabel(optionId: bigint): Promise<string | null>;
}

/** Currency Setup (admin-facing) — Coupon Setup, same shape as WarehouseRepository/
 *  CurrencyRepository/PriceListRepository: create/list/update/soft-delete admin CRUD. */
export interface CouponRepository {
  create(input: CreateCouponInput): Promise<CouponInfo>;
  findByCode(code: string): Promise<CouponInfo | null>;
  list(): Promise<CouponInfo[]>;
  update(code: string, input: UpdateCouponInput): Promise<CouponInfo>;
  softDelete(code: string): Promise<void>;
  /** The storefront PDP's "Offers" section — every active, date-in-range
   *  coupon that would actually apply to this one product: every CART-
   *  target coupon (store-wide, no conditions to check) plus every ITEM-
   *  target coupon whose conditions this product matches (reuses the same
   *  productMatchesConditions() resolution the cart-evaluation path
   *  already runs, just against one bare product instead of cart lines —
   *  see PrismaCouponRepository's own resolveProductContext()). */
  listApplicableForProduct(productId: bigint, asOf: Date): Promise<CouponInfo[]>;
}

export interface DiscountLineInput {
  variantId: bigint;
  /** Already in hand at every call site via VariantLookup.byId() for other reasons
   *  (price/name resolution) — no new query needed to supply this. */
  productId: bigint;
  subtotalMinor: bigint;
}

export interface EvaluateCouponInput {
  code: string;
  cartCurrency: string;
  lines: DiscountLineInput[];
  customerId: bigint | null;
  asOf: Date;
}

export interface CouponEvaluation {
  couponId: bigint;
  code: string;
  targetType: CouponTargetType;
  /** Clamped: never exceeds the discount base (whole-cart subtotal for CART,
   *  matching-lines subtotal for ITEM) so a grand total can never go negative. */
  discountAmountMinor: bigint;
  /** Per-line allocation of discountAmountMinor (largest-remainder proportional
   *  split by subtotal share — see shared/domain/allocation.ts) — sums exactly to
   *  discountAmountMinor. CART: every input line with non-zero subtotal appears.
   *  ITEM: only the lines the coupon's conditions matched appear. */
  lineDiscounts: { variantId: bigint; discountAmountMinor: bigint }[];
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
   *  (not-found/inactive/expired/min-subtotal/currency-mismatch/usage-limit/
   *  no-eligible-items) on any invalid coupon rather than returning null —
   *  callers decide whether to propagate (checkout, manual apply) or swallow into
   *  a soft `couponError` (cart preview). */
  evaluate(input: EvaluateCouponInput): Promise<CouponEvaluation>;
  /** Scans isActive+isAutoApply coupons, running the same eligibility +
   *  condition-matching + usage-limit checks evaluate() does per candidate, and
   *  returns the one yielding the greatest discountAmountMinor (ties broken by
   *  lowest coupon id) — or null if none is eligible. Never throws for an
   *  individual ineligible candidate (that candidate is just skipped); only a
   *  genuine infrastructure error propagates. Callers never persist the result
   *  onto Cart — auto-apply is always recomputed live from current cart contents. */
  findBestAutoApply(input: Omit<EvaluateCouponInput, 'code'>): Promise<CouponEvaluation | null>;
  /** Guarded usage-count UPDATE + CouponRedemption insert, one DB transaction.
   *  Throws CouponUsageLimitExceededError if the guarded UPDATE affects 0 rows
   *  (the limit was hit, including a race lost against a concurrent checkout). */
  redeem(input: RedeemCouponInput): Promise<void>;
}
