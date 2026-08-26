import type { AttributeDataType, Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { toMinorUnits, fromMinorUnits, allocateProportionally, SCALE } from '../../../shared/domain/decimal.js';
import { DomainError } from '../../../shared/domain/errors.js';
import { PrismaProductAttributeStore } from '../../catalog/infrastructure/product-attribute.store.js';
import { fromRow, type AttributeValueColumns } from '../../catalog/domain/attribute-value.js';
import type {
  CouponRepository,
  CouponInfo,
  CouponConditionInfo,
  CreateCouponInput,
  CreateCouponConditionInput,
  UpdateCouponInput,
  DiscountCalculator,
  DiscountLineInput,
  EvaluateCouponInput,
  CouponEvaluation,
  RedeemCouponInput,
} from '../domain/repositories.js';
import { productMatchesConditions, type ProductMatchContext } from '../domain/condition-matcher.js';
import {
  CouponNotFoundError,
  CouponInactiveError,
  CouponNotStartedError,
  CouponExpiredError,
  CouponMinSubtotalNotMetError,
  CouponCurrencyMismatchError,
  CouponUsageLimitExceededError,
  CouponPerCustomerLimitExceededError,
  CouponNoEligibleItemsError,
} from '../domain/errors.js';

const PERCENT_DIVISOR = 100n * 10n ** BigInt(SCALE);

type CouponRow = Prisma.CouponGetPayload<{ include: { conditions: true } }>;

// Prisma's Decimal.toString() strips trailing zeros ("10.0000" -> "10"); this
// round-trip through the fixed-point minor-units helpers restores the scale-4
// string, same fix already applied in prisma-giftcard-ledger.ts.
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

function toConditionInfo(row: CouponRow['conditions'][number]): CouponConditionInfo {
  return {
    conditionType: row.conditionType,
    productId: row.productId,
    categoryId: row.categoryId,
    attributeId: row.attributeId,
    attributeValue: row.attributeValue,
  };
}

function toConditionCreateData(c: CreateCouponConditionInput): Prisma.CouponConditionCreateWithoutCouponInput {
  return {
    conditionType: c.conditionType,
    productId: c.productId ?? null,
    categoryId: c.categoryId ?? null,
    attributeId: c.attributeId ?? null,
    attributeValue: c.attributeValue ?? null,
  };
}

function toInfo(row: CouponRow): CouponInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    code: row.code,
    description: row.description,
    discountType: row.discountType as CouponInfo['discountType'],
    value: formatDecimal(row.value),
    currency: row.currency,
    minSubtotal: row.minSubtotal ? formatDecimal(row.minSubtotal) : null,
    targetType: row.targetType,
    isAutoApply: row.isAutoApply,
    conditions: row.conditions.map(toConditionInfo),
    usageLimit: row.usageLimit,
    usageLimitPerCustomer: row.usageLimitPerCustomer,
    usageCount: row.usageCount,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
  };
}

// fromRow() already picks the right typed column per dataType; this just
// flattens whatever it returns into comparable strings for condition-matcher.ts
// — a scalar becomes a one-element array, MULTISELECT's array passes through
// element-wise, Dates become ISO strings. SELECT/REF_* attributes come back as
// AttributeOption ids (fromRow's existing behavior, not text) — matching on ids
// is simpler and avoids any text/locale drift.
function toComparableStrings(dataType: AttributeDataType, columns: AttributeValueColumns): string[] {
  const raw = fromRow(dataType, columns);
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (raw instanceof Date) return [raw.toISOString()];
  return [String(raw)];
}

export class PrismaCouponRepository implements CouponRepository, DiscountCalculator {
  private readonly attributeStore: PrismaProductAttributeStore;

  constructor(private readonly db: Db) {
    // Cross-module reuse, same construction pattern already used for this class
    // itself elsewhere (order.module.ts constructing PrismaCouponRepository
    // directly) — Catalog's own read path, not reinvented here.
    this.attributeStore = new PrismaProductAttributeStore(db);
  }

  async create(input: CreateCouponInput): Promise<CouponInfo> {
    const row = await this.db.coupon.create({
      data: {
        code: input.code,
        description: input.description,
        discountType: input.discountType,
        value: input.value,
        currency: input.currency ?? null,
        minSubtotal: input.minSubtotal ?? undefined,
        targetType: input.targetType ?? 'CART',
        isAutoApply: input.isAutoApply ?? false,
        usageLimit: input.usageLimit ?? undefined,
        usageLimitPerCustomer: input.usageLimitPerCustomer ?? undefined,
        startsAt: input.startsAt ?? undefined,
        endsAt: input.endsAt ?? undefined,
        isActive: input.isActive,
        conditions: input.conditions && input.conditions.length > 0 ? { create: input.conditions.map(toConditionCreateData) } : undefined,
      },
      include: { conditions: true },
    });
    return toInfo(row);
  }

  async findByCode(code: string): Promise<CouponInfo | null> {
    const row = await this.db.coupon.findFirst({ where: { code }, include: { conditions: true } });
    return row ? toInfo(row) : null;
  }

  async list(): Promise<CouponInfo[]> {
    const rows = await this.db.coupon.findMany({ orderBy: { createdAt: 'desc' }, include: { conditions: true } });
    return rows.map(toInfo);
  }

  async listApplicableForProduct(productId: bigint, asOf: Date): Promise<CouponInfo[]> {
    const candidates = await this.db.coupon.findMany({
      where: {
        isActive: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: asOf } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: asOf } }] }],
      },
      include: { conditions: true },
    });
    if (candidates.length === 0) return [];

    // Resolved once, reused across every ITEM-target candidate — same
    // "one context per distinct product" economy resolveContributingLines
    // already applies per-cart, just for a single product here.
    let productContext: ProductMatchContext | null = null;
    const applicable: CouponRow[] = [];
    for (const coupon of candidates) {
      if (coupon.targetType === 'CART') {
        applicable.push(coupon);
        continue;
      }
      productContext ??= await this.resolveProductContext(productId);
      if (productMatchesConditions(coupon.conditions, productContext)) applicable.push(coupon);
    }
    return applicable.map(toInfo);
  }

  async update(code: string, input: UpdateCouponInput): Promise<CouponInfo> {
    const row = await this.db.$transaction(async (tx) => {
      // Simplest-correct approach for a small, admin-authored config list:
      // wholesale replace rather than diff. Only touches rows when the caller
      // actually sent a conditions array — omitting it leaves existing
      // conditions untouched (e.g. a plain isActive toggle).
      if (input.conditions !== undefined) {
        await tx.couponCondition.deleteMany({ where: { coupon: { code } } });
      }
      return tx.coupon.update({
        where: { code },
        data: {
          description: input.description,
          discountType: input.discountType,
          value: input.value,
          currency: input.currency,
          minSubtotal: input.minSubtotal,
          targetType: input.targetType,
          isAutoApply: input.isAutoApply,
          usageLimit: input.usageLimit,
          usageLimitPerCustomer: input.usageLimitPerCustomer,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          isActive: input.isActive,
          conditions:
            input.conditions !== undefined && input.conditions.length > 0 ? { create: input.conditions.map(toConditionCreateData) } : undefined,
        },
        include: { conditions: true },
      });
    });
    return toInfo(row);
  }

  async softDelete(code: string): Promise<void> {
    // The shared soft-delete extension (shared/infrastructure/prisma/client.ts)
    // remaps this delete() into an UPDATE deletedAt = now() automatically.
    // coupon_condition rows are left in place (harmless — a soft-deleted coupon
    // is never evaluated/auto-applied again).
    await this.db.coupon.delete({ where: { code } });
  }

  /** Ancestor-inclusive category ids for a product (its own assigned categories
   *  plus every ancestor of each, via category_closure's depth-0-included rows)
   *  — same closure-table shape PrismaCategoryMembershipLookup.categoryPublicIds
   *  already queries, just selecting the internal id directly instead of joining
   *  through to category.public_id (all condition-matching needs). */
  private async resolveCategoryAncestorIds(productId: bigint): Promise<Set<bigint>> {
    const rows = await this.db.$queryRaw<Array<{ ancestor_id: bigint }>>`
      SELECT DISTINCT cc.ancestor_id
      FROM product_category pc
      JOIN category_closure cc ON cc.descendant_id = pc.category_id
      WHERE pc.product_id = ${productId}`;
    return new Set(rows.map((r) => r.ancestor_id));
  }

  private async resolveProductContext(productId: bigint): Promise<ProductMatchContext> {
    const [attributes, categoryIds] = await Promise.all([this.attributeStore.resolveGlobalValues(productId), this.resolveCategoryAncestorIds(productId)]);
    const attributeValues = new Map<string, Set<string>>();
    for (const attr of attributes) {
      const values = toComparableStrings(attr.dataType, attr.columns);
      if (values.length > 0) attributeValues.set(attr.attributeId.toString(), new Set(values));
    }
    return { productId, categoryIds, attributeValues };
  }

  /** CART: every input line contributes (discount base = whole cart subtotal).
   *  ITEM: only lines whose product matches every condition group — this is the
   *  ONLY place condition-matching runs, shared by evaluate() and
   *  findBestAutoApply() so eligibility logic exists exactly once. Resolves
   *  product context once per DISTINCT productId (bounded by distinct-product
   *  count in the cart, not line count) — skipped entirely for CART-target
   *  coupons, which never have conditions. */
  private async resolveContributingLines(coupon: CouponRow, lines: DiscountLineInput[]): Promise<DiscountLineInput[]> {
    if (coupon.targetType === 'CART') return lines;
    const contextByProductId = new Map<string, ProductMatchContext>();
    for (const productId of new Set(lines.map((l) => l.productId))) {
      contextByProductId.set(productId.toString(), await this.resolveProductContext(productId));
    }
    return lines.filter((l) => productMatchesConditions(coupon.conditions, contextByProductId.get(l.productId.toString())!));
  }

  private async evaluateCouponRow(coupon: CouponRow, input: EvaluateCouponInput | Omit<EvaluateCouponInput, 'code'>): Promise<CouponEvaluation> {
    if (!coupon.isActive) throw new CouponInactiveError(coupon.code);
    if (coupon.startsAt && input.asOf < coupon.startsAt) throw new CouponNotStartedError(coupon.code);
    if (coupon.endsAt && input.asOf > coupon.endsAt) throw new CouponExpiredError(coupon.code);
    if (coupon.currency && coupon.currency.toUpperCase() !== input.cartCurrency.toUpperCase()) {
      throw new CouponCurrencyMismatchError(coupon.code);
    }

    // Which lines the discount base is computed from — determined BEFORE the
    // minSubtotal check, since minSubtotal always compares against the discount
    // base (whole cart for CART, matching items only for ITEM), not the whole cart.
    const contributingLines = await this.resolveContributingLines(coupon, input.lines);
    if (coupon.targetType === 'ITEM' && contributingLines.length === 0) {
      throw new CouponNoEligibleItemsError(coupon.code);
    }
    const baseMinor = contributingLines.reduce((sum, l) => sum + l.subtotalMinor, 0n);

    if (coupon.minSubtotal && baseMinor < toMinorUnits(coupon.minSubtotal.toString())) {
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
      const usedCount = await this.db.couponRedemption.count({ where: { couponId: coupon.id, customerId: input.customerId } });
      if (usedCount >= coupon.usageLimitPerCustomer) {
        throw new CouponPerCustomerLimitExceededError(coupon.code);
      }
    }

    const valueMinor = toMinorUnits(coupon.value.toString());
    const rawDiscountMinor = coupon.discountType === 'PERCENTAGE' ? (baseMinor * valueMinor) / PERCENT_DIVISOR : valueMinor;
    // Clamped so a grand total (subtotal - discount + tax + shipping) can never go
    // negative — tax/shipping are always >= 0, so discount <= base suffices.
    const discountAmountMinor = rawDiscountMinor > baseMinor ? baseMinor : rawDiscountMinor;

    const allocation = allocateProportionally(
      discountAmountMinor,
      contributingLines.map((l) => ({ key: l.variantId, baseMinor: l.subtotalMinor })),
    );
    const lineDiscounts = contributingLines.map((l) => ({ variantId: l.variantId, discountAmountMinor: allocation.get(l.variantId) ?? 0n }));

    return { couponId: coupon.id, code: coupon.code, targetType: coupon.targetType, discountAmountMinor, lineDiscounts };
  }

  async evaluate(input: EvaluateCouponInput): Promise<CouponEvaluation> {
    const coupon = await this.db.coupon.findFirst({ where: { code: input.code }, include: { conditions: true } });
    if (!coupon) throw new CouponNotFoundError(input.code);
    return this.evaluateCouponRow(coupon, input);
  }

  async findBestAutoApply(input: Omit<EvaluateCouponInput, 'code'>): Promise<CouponEvaluation | null> {
    const candidates = await this.db.coupon.findMany({
      where: { isActive: true, isAutoApply: true },
      include: { conditions: true },
    });

    let best: CouponEvaluation | null = null;
    for (const coupon of candidates) {
      let evaluation: CouponEvaluation;
      try {
        evaluation = await this.evaluateCouponRow(coupon, input);
      } catch (err) {
        // An ineligible auto-apply candidate is never an error the customer
        // sees — they never typed anything to reject. A genuine infra error
        // (DB connection loss etc.) still propagates rather than being masked.
        if (err instanceof DomainError) continue;
        throw err;
      }
      if (!best || evaluation.discountAmountMinor > best.discountAmountMinor || (evaluation.discountAmountMinor === best.discountAmountMinor && evaluation.couponId < best.couponId)) {
        best = evaluation;
      }
    }
    return best;
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
