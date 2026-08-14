import { DomainError, NotFoundError } from '../../../shared/domain/errors.js';

export class CouponNotFoundError extends NotFoundError {
  constructor(code: string) {
    super('Coupon', code);
  }
}

export class CouponInactiveError extends DomainError {
  constructor(code: string) {
    super(`coupon ${code} is not active`, 'https://errors.ome/coupon-inactive', 409);
  }
}

export class CouponNotStartedError extends DomainError {
  constructor(code: string) {
    super(`coupon ${code} is not valid yet`, 'https://errors.ome/coupon-not-started', 409);
  }
}

export class CouponExpiredError extends DomainError {
  constructor(code: string) {
    super(`coupon ${code} has expired`, 'https://errors.ome/coupon-expired', 409);
  }
}

export class CouponMinSubtotalNotMetError extends DomainError {
  constructor(code: string, minSubtotal: string) {
    super(`coupon ${code} requires a minimum subtotal of ${minSubtotal}`, 'https://errors.ome/coupon-min-subtotal', 422);
  }
}

export class CouponCurrencyMismatchError extends DomainError {
  constructor(code: string) {
    super(`coupon ${code} is not valid in this currency`, 'https://errors.ome/coupon-currency-mismatch', 422);
  }
}

/** Thrown when the guarded usage-count UPDATE affects 0 rows — the global usage limit was hit,
 *  including the race-lost case (see prisma-coupon.repository.ts's redeem()). */
export class CouponUsageLimitExceededError extends DomainError {
  constructor(code: string) {
    super(`coupon ${code} has reached its usage limit`, 'https://errors.ome/coupon-usage-limit', 409);
  }
}

export class CouponPerCustomerLimitExceededError extends DomainError {
  constructor(code: string) {
    super(`you have already used coupon ${code} the maximum number of times`, 'https://errors.ome/coupon-per-customer-limit', 409);
  }
}

/** Thrown by evaluate() for a targetType='ITEM' coupon when zero cart lines match its
 *  conditions — a real, visible rejection for a manually-entered code. findBestAutoApply()
 *  never throws this; it treats zero-matching as "not eligible" and silently skips the
 *  candidate (the customer never typed anything to reject). */
export class CouponNoEligibleItemsError extends DomainError {
  constructor(code: string) {
    super(`coupon ${code} does not apply to any items in your cart`, 'https://errors.ome/coupon-no-eligible-items', 422);
  }
}
