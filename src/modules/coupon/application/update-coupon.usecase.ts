import type { CouponRepository, CreateCouponConditionInput, ProductLookup, CategoryLookup, AttributeLookup } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { UpdateCouponCommand, CouponView } from './dto.js';
import { toView } from './to-view.js';
import { resolveConditions } from './resolve-conditions.js';

export class UpdateCoupon {
  constructor(
    private readonly coupons: CouponRepository,
    private readonly products: ProductLookup,
    private readonly categories: CategoryLookup,
    private readonly attributes: AttributeLookup,
  ) {}

  async execute(cmd: UpdateCouponCommand): Promise<CouponView> {
    const existing = await this.coupons.findByCode(cmd.code);
    if (!existing) throw new NotFoundError('Coupon', cmd.code);

    const discountType = cmd.discountType ?? existing.discountType;
    const currency = cmd.currency !== undefined ? cmd.currency : existing.currency;
    const value = cmd.value ?? existing.value;

    if (discountType === 'FIXED_AMOUNT' && !currency) {
      throw new ValidationError('a fixed-amount coupon requires a currency', [{ path: 'currency', message: 'required for FIXED_AMOUNT' }]);
    }
    if (discountType === 'PERCENTAGE') {
      if (currency) {
        throw new ValidationError('a percentage coupon must not have a currency', [{ path: 'currency', message: 'must be omitted for PERCENTAGE' }]);
      }
      const num = Number(value);
      if (!(num >= 0 && num <= 100)) {
        throw new ValidationError("a percentage coupon's value must be between 0 and 100", [{ path: 'value', message: 'must be 0-100' }]);
      }
    }

    const targetType = cmd.targetType ?? existing.targetType;
    // Whether the final condition count (after this update) is known: explicit
    // conditions in this command, else whatever the coupon already has.
    const finalConditionCount = cmd.conditions !== undefined ? cmd.conditions.length : existing.conditions.length;
    if (targetType === 'ITEM' && finalConditionCount === 0) {
      throw new ValidationError('an item-target coupon requires at least one condition', [{ path: 'conditions', message: 'required for targetType=ITEM' }]);
    }
    if (targetType === 'CART' && finalConditionCount > 0) {
      throw new ValidationError('a cart-target coupon must not have conditions', [{ path: 'conditions', message: 'must be omitted for targetType=CART' }]);
    }

    const conditions: CreateCouponConditionInput[] | undefined = cmd.conditions
      ? await resolveConditions(cmd.conditions, { products: this.products, categories: this.categories, attributes: this.attributes })
      : undefined;

    const c = await this.coupons.update(cmd.code, {
      description: cmd.description,
      discountType: cmd.discountType,
      value: cmd.value,
      currency: cmd.currency,
      minSubtotal: cmd.minSubtotal,
      targetType: cmd.targetType,
      isAutoApply: cmd.isAutoApply,
      conditions,
      usageLimit: cmd.usageLimit,
      usageLimitPerCustomer: cmd.usageLimitPerCustomer,
      startsAt: cmd.startsAt !== undefined ? (cmd.startsAt ? new Date(cmd.startsAt) : null) : undefined,
      endsAt: cmd.endsAt !== undefined ? (cmd.endsAt ? new Date(cmd.endsAt) : null) : undefined,
      isActive: cmd.isActive,
    });
    return toView(c, { products: this.products, categories: this.categories, attributes: this.attributes });
  }
}
