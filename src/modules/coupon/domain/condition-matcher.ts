import type { CouponConditionInfo } from './repositories.js';

/**
 * Everything condition-matching needs about ONE product, resolved once per
 * distinct productId in a cart by PrismaCouponRepository (never per cart line —
 * multiple lines can share a product). attributeValues is keyed by
 * attributeId.toString() (bigint keys aren't usable in a Map/Set the way string
 * keys are) and holds every comparable string value the attribute has for this
 * product — for MULTISELECT that's every selected option id; for everything
 * else it's a one-element set. Values are exactly what attribute-value.ts's
 * fromRow() returns, stringified — GLOBAL scope only (documented simplification,
 * see coupon.prisma's header comment).
 */
export interface ProductMatchContext {
  productId: bigint;
  /** Self + every ancestor category id (category_closure), so a condition on a
   *  parent category still matches a product assigned only to a child category. */
  categoryIds: ReadonlySet<bigint>;
  attributeValues: ReadonlyMap<string, ReadonlySet<string>>;
}

interface ConditionGroups {
  /** null = no PRODUCT conditions on this coupon (group absent, doesn't constrain matching). */
  productIds: bigint[] | null;
  categoryIds: bigint[] | null;
  /** attributeId.toString() -> allowed values (OR'd together within this one attribute). */
  attributeGroups: Map<string, string[]>;
}

function buildGroups(conditions: CouponConditionInfo[]): ConditionGroups {
  const productIds: bigint[] = [];
  const categoryIds: bigint[] = [];
  const attributeGroups = new Map<string, string[]>();
  for (const c of conditions) {
    if (c.conditionType === 'PRODUCT' && c.productId != null) {
      productIds.push(c.productId);
    } else if (c.conditionType === 'CATEGORY' && c.categoryId != null) {
      categoryIds.push(c.categoryId);
    } else if (c.conditionType === 'ATTRIBUTE' && c.attributeId != null && c.attributeValue != null) {
      const key = c.attributeId.toString();
      const values = attributeGroups.get(key) ?? [];
      values.push(c.attributeValue);
      attributeGroups.set(key, values);
    }
  }
  return {
    productIds: productIds.length > 0 ? productIds : null,
    categoryIds: categoryIds.length > 0 ? categoryIds : null,
    attributeGroups,
  };
}

/**
 * A product is eligible iff it matches EVERY group that has >=1 condition row
 * (AND across groups — the PRODUCT group, the CATEGORY group, and one group per
 * distinct attributeId), where matching a group means matching ANY row within it
 * (OR within a group — e.g. two PRODUCT rows means "either of these products";
 * two ATTRIBUTE rows both on Color means "Color is either of these values").
 * A coupon with zero conditions (only ever true for a CART-target coupon, which
 * never calls this) trivially matches everything — defensive default, not a
 * path any ITEM-target coupon can reach (DB + app enforce >=1 condition for ITEM).
 */
export function productMatchesConditions(conditions: CouponConditionInfo[], context: ProductMatchContext): boolean {
  const groups = buildGroups(conditions);

  if (groups.productIds && !groups.productIds.some((id) => id === context.productId)) {
    return false;
  }
  if (groups.categoryIds && !groups.categoryIds.some((id) => context.categoryIds.has(id))) {
    return false;
  }
  for (const [attributeId, allowedValues] of groups.attributeGroups) {
    const actualValues = context.attributeValues.get(attributeId);
    if (!actualValues || !allowedValues.some((v) => actualValues.has(v))) {
      return false;
    }
  }
  return true;
}
