import type { CouponRepository } from '../domain/repositories.js';
import { ConflictError, ValidationError } from '../../../shared/domain/errors.js';
import type { CreateCouponCommand, CouponView } from './dto.js';
import { toView } from './to-view.js';

export class CreateCoupon {
  constructor(private readonly coupons: CouponRepository) {}

  async execute(cmd: CreateCouponCommand): Promise<CouponView> {
    const code = cmd.code.trim().toUpperCase();
    if (await this.coupons.findByCode(code)) {
      throw new ConflictError(`coupon code already exists: ${code}`);
    }

    // Defense in depth alongside the DB's own CHECK constraints
    // (coupon_fixed_amount_requires_currency / coupon_percentage_forbids_currency /
    // coupon_percentage_value_range) — a clean 422 here beats a raw constraint
    // violation surfacing as a 500.
    if (cmd.discountType === 'FIXED_AMOUNT' && !cmd.currency) {
      throw new ValidationError('a fixed-amount coupon requires a currency', [
        { path: 'currency', message: 'required for FIXED_AMOUNT' },
      ]);
    }
    if (cmd.discountType === 'PERCENTAGE') {
      if (cmd.currency) {
        throw new ValidationError('a percentage coupon must not have a currency', [
          { path: 'currency', message: 'must be omitted for PERCENTAGE' },
        ]);
      }
      const value = Number(cmd.value);
      if (!(value >= 0 && value <= 100)) {
        throw new ValidationError('a percentage coupon\'s value must be between 0 and 100', [
          { path: 'value', message: 'must be 0-100' },
        ]);
      }
    }

    const c = await this.coupons.create({
      code,
      description: cmd.description,
      discountType: cmd.discountType,
      value: cmd.value,
      currency: cmd.currency ?? null,
      minSubtotal: cmd.minSubtotal ?? null,
      usageLimit: cmd.usageLimit ?? null,
      usageLimitPerCustomer: cmd.usageLimitPerCustomer ?? null,
      startsAt: cmd.startsAt ? new Date(cmd.startsAt) : null,
      endsAt: cmd.endsAt ? new Date(cmd.endsAt) : null,
      isActive: cmd.isActive,
    });
    return toView(c);
  }
}
