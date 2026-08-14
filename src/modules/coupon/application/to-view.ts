import type { CouponInfo } from '../domain/repositories.js';
import type { CouponView } from './dto.js';

export function toView(c: CouponInfo): CouponView {
  return {
    publicId: c.publicId,
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    value: c.value,
    currency: c.currency,
    minSubtotal: c.minSubtotal,
    usageLimit: c.usageLimit,
    usageLimitPerCustomer: c.usageLimitPerCustomer,
    usageCount: c.usageCount,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
    isActive: c.isActive,
  };
}
