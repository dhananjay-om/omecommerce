import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { toMinorUnits, fromMinorUnits, SCALE } from '../../../shared/domain/decimal.js';
import type {
  CouponRepository,
  CouponInfo,
  CreateCouponInput,
  UpdateCouponInput,
  DiscountCalculator,
  EvaluateCouponInput,
  CouponEvaluation,
  RedeemCouponInput,
} from '../domain/repositories.js';
import {
  CouponNotFoundError,
  CouponInactiveError,
  CouponNotStartedError,
  CouponExpiredError,
  CouponMinSubtotalNotMetError,
  CouponCurrencyMismatchError,
  CouponUsageLimitExceededError,
  CouponPerCustomerLimitExceededError,
} from '../domain/errors.js';

const PERCENT_DIVISOR = 100n * 10n ** BigInt(SCALE);

// Prisma's Decimal.toString() strips trailing zeros ("10.0000" -> "10"); this
// round-trip through the fixed-point minor-units helpers restores the scale-4
// string, same fix already applied in prisma-giftcard-ledger.ts.
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

function toInfo(row: {
  id: bigint;
  publicId: string;
  code: string;
  description: string | null;
  discountType: string;
  value: { toString(): string };
  currency: string | null;
  minSubtotal: { toString(): string } | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}): CouponInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    code: row.code,
    description: row.description,
    discountType: row.discountType as CouponInfo['discountType'],
    value: formatDecimal(row.value),
    currency: row.currency,
    minSubtotal: row.minSubtotal ? formatDecimal(row.minSubtotal) : null,
    usageLimit: row.usageLimit,
    usageLimitPerCustomer: row.usageLimitPerCustomer,
    usageCount: row.usageCount,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
  };
}

export class PrismaCouponRepository implements CouponRepository, DiscountCalculator {
  constructor(private readonly db: Db) {}

  async create(input: CreateCouponInput): Promise<CouponInfo> {
    const row = await this.db.coupon.create({
      data: {
        code: input.code,
        description: input.description,
        discountType: input.discountType,
        value: input.value,
        currency: input.currency ?? null,
        minSubtotal: input.minSubtotal ?? undefined,
        usageLimit: input.usageLimit ?? undefined,
        usageLimitPerCustomer: input.usageLimitPerCustomer ?? undefined,
        startsAt: input.startsAt ?? undefined,
        endsAt: input.endsAt ?? undefined,
        isActive: input.isActive,
      },
    });
    return toInfo(row);
  }

  async findByCode(code: string): Promise<CouponInfo | null> {
    const row = await this.db.coupon.findFirst({ where: { code } });
    return row ? toInfo(row) : null;
  }

  async list(): Promise<CouponInfo[]> {
    const rows = await this.db.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toInfo);
  }

  async update(code: string, input: UpdateCouponInput): Promise<CouponInfo> {
    const row = await this.db.coupon.update({
      where: { code },
      data: {
        description: input.description,
        discountType: input.discountType,
        value: input.value,
        currency: input.currency,
        minSubtotal: input.minSubtotal,
        usageLimit: input.usageLimit,
        usageLimitPerCustomer: input.usageLimitPerCustomer,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isActive: input.isActive,
      },
    });
    return toInfo(row);
  }

  async softDelete(code: string): Promise<void> {
    // The shared soft-delete extension (shared/infrastructure/prisma/client.ts)
    // remaps this delete() into an UPDATE deletedAt = now() automatically.
    await this.db.coupon.delete({ where: { code } });
  }

  async evaluate(input: EvaluateCouponInput): Promise<CouponEvaluation> {
    const coupon = await this.db.coupon.findFirst({ where: { code: input.code } });
    if (!coupon) throw new CouponNotFoundError(input.code);
    if (!coupon.isActive) throw new CouponInactiveError(coupon.code);
    if (coupon.startsAt && input.asOf < coupon.startsAt) throw new CouponNotStartedError(coupon.code);
    if (coupon.endsAt && input.asOf > coupon.endsAt) throw new CouponExpiredError(coupon.code);
    if (coupon.currency && coupon.currency.toUpperCase() !== input.cartCurrency.toUpperCase()) {
      throw new CouponCurrencyMismatchError(coupon.code);
    }
    if (coupon.minSubtotal && input.subtotalMinor < toMinorUnits(coupon.minSubtotal.toString())) {
      throw new CouponMinSubtotalNotMetError(coupon.code, coupon.minSubtotal.toString());
    }
    // Optimistic pre-check — the authoritative guard is redeem()'s transactional
    // UPDATE, which is what actually protects against a race between two
    // concurrent checkouts both passing this check.
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new CouponUsageLimitExceededError(coupon.code);
    }
    // Guest carts (customerId=null) are exempt from the per-customer limit —
    // there's no identity to count against, only the global usageLimit applies.
    if (coupon.usageLimitPerCustomer !== null && input.customerId !== null) {
      const usedCount = await this.db.couponRedemption.count({
        where: { couponId: coupon.id, customerId: input.customerId },
      });
      if (usedCount >= coupon.usageLimitPerCustomer) {
        throw new CouponPerCustomerLimitExceededError(coupon.code);
      }
    }

    const valueMinor = toMinorUnits(coupon.value.toString());
    const rawDiscountMinor =
      coupon.discountType === 'PERCENTAGE' ? (input.subtotalMinor * valueMinor) / PERCENT_DIVISOR : valueMinor;
    // Clamped so a grand total (subtotal - discount + tax + shipping) can never go
    // negative — tax/shipping are always >= 0, so discount <= subtotal suffices.
    const discountAmountMinor = rawDiscountMinor > input.subtotalMinor ? input.subtotalMinor : rawDiscountMinor;

    return { couponId: coupon.id, code: coupon.code, discountAmountMinor };
  }

  async redeem(input: RedeemCouponInput): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
        UPDATE coupon
           SET usage_count = usage_count + 1
         WHERE id = ${input.couponId} AND (usage_limit IS NULL OR usage_count < usage_limit)
         RETURNING id`;
      if (rows.length === 0) {
        const coupon = await tx.coupon.findUnique({ where: { id: input.couponId } });
        throw new CouponUsageLimitExceededError(coupon?.code ?? input.couponId.toString());
      }
      await tx.couponRedemption.create({
        data: {
          couponId: input.couponId,
          orderId: input.orderId,
          customerId: input.customerId,
          currency: input.currency,
          discountAmount: fromMinorUnits(input.discountAmountMinor),
        },
      });
    });
  }
}
