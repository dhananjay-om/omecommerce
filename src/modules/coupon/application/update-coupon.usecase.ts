import type { CouponRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { UpdateCouponCommand, CouponView } from './dto.js';
import { toView } from './to-view.js';

export class UpdateCoupon {
  constructor(private readonly coupons: CouponRepository) {}

  async execute(cmd: UpdateCouponCommand): Promise<CouponView> {
    const existing = await this.coupons.findByCode(cmd.code);
    if (!existing) throw new NotFoundError('Coupon', cmd.code);

    const discountType = cmd.discountType ?? existing.discountType;
    const currency = cmd.currency !== undefined ? cmd.currency : existing.currency;
    const value = cmd.value ?? existing.value;

    if (discountType === 'FIXED_AMOUNT' && !currency) {
      throw new ValidationError('a fixed-amount coupon requires a currency', [
        { path: 'currency', message: 'required for FIXED_AMOUNT' },
      ]);
    }
    if (discountType === 'PERCENTAGE') {
      if (currency) {
        throw new ValidationError('a percentage coupon must not have a currency', [
          { path: 'currency', message: 'must be omitted for PERCENTAGE' },
        ]);
      }
      const num = Number(value);
      if (!(num >= 0 && num <= 100)) {
        throw new ValidationError('a percentage coupon\'s value must be between 0 and 100', [
          { path: 'value', message: 'must be 0-100' },
        ]);
      }
    }

    const c = await this.coupons.update(cmd.code, {
      description: cmd.description,
      discountType: cmd.discountType,
      value: cmd.value,
      currency: cmd.currency,
      minSubtotal: cmd.minSubtotal,
      usageLimit: cmd.usageLimit,
      usageLimitPerCustomer: cmd.usageLimitPerCustomer,
      startsAt: cmd.startsAt !== undefined ? (cmd.startsAt ? new Date(cmd.startsAt) : null) : undefined,
      endsAt: cmd.endsAt !== undefined ? (cmd.endsAt ? new Date(cmd.endsAt) : null) : undefined,
      isActive: cmd.isActive,
    });
    return toView(c);
  }
}
