import { describe, it, expect } from 'vitest';
import { productMatchesConditions, type ProductMatchContext } from '../../src/modules/coupon/domain/condition-matcher.js';
import type { CouponConditionInfo } from '../../src/modules/coupon/domain/repositories.js';

function context(overrides: Partial<ProductMatchContext> = {}): ProductMatchContext {
  return {
    productId: 1n,
    categoryIds: new Set(),
    attributeValues: new Map(),
    ...overrides,
  };
}

function product(id: bigint): CouponConditionInfo {
  return { conditionType: 'PRODUCT', productId: id, categoryId: null, attributeId: null, attributeValue: null };
}

function category(id: bigint): CouponConditionInfo {
  return { conditionType: 'CATEGORY', productId: null, categoryId: id, attributeId: null, attributeValue: null };
}

function attribute(id: bigint, value: string): CouponConditionInfo {
  return { conditionType: 'ATTRIBUTE', productId: null, categoryId: null, attributeId: id, attributeValue: value };
}

describe('condition-matcher (coupon item-targeting)', () => {
  it('a coupon with zero conditions matches everything (defensive default — never reached for a real ITEM coupon)', () => {
    expect(productMatchesConditions([], context())).toBe(true);
  });

  it('PRODUCT: matches when the product id is in the list (OR within the group)', () => {
    const conditions = [product(1n), product(2n)];
    expect(productMatchesConditions(conditions, context({ productId: 1n }))).toBe(true);
    expect(productMatchesConditions(conditions, context({ productId: 2n }))).toBe(true);
    expect(productMatchesConditions(conditions, context({ productId: 3n }))).toBe(false);
  });

  it('CATEGORY: matches when any of the listed category ids is in the product\'s (ancestor-inclusive) category set', () => {
    const conditions = [category(10n)];
    expect(productMatchesConditions(conditions, context({ categoryIds: new Set([10n, 20n]) }))).toBe(true);
    expect(productMatchesConditions(conditions, context({ categoryIds: new Set([20n]) }))).toBe(false);
  });

  it('ATTRIBUTE: two rows on the SAME attribute OR together', () => {
    const conditions = [attribute(5n, 'red'), attribute(5n, 'blue')];
    expect(productMatchesConditions(conditions, context({ attributeValues: new Map([['5', new Set(['red'])]]) }))).toBe(true);
    expect(productMatchesConditions(conditions, context({ attributeValues: new Map([['5', new Set(['blue'])]]) }))).toBe(true);
    expect(productMatchesConditions(conditions, context({ attributeValues: new Map([['5', new Set(['green'])]]) }))).toBe(false);
    expect(productMatchesConditions(conditions, context())).toBe(false); // attribute never resolved for this product
  });

  it('ATTRIBUTE: two rows on DIFFERENT attributes AND together', () => {
    const conditions = [attribute(5n, 'red'), attribute(6n, 'cotton')];
    const bothMatch = context({
      attributeValues: new Map([
        ['5', new Set(['red'])],
        ['6', new Set(['cotton'])],
      ]),
    });
    expect(productMatchesConditions(conditions, bothMatch)).toBe(true);

    const onlyColorMatches = context({ attributeValues: new Map([['5', new Set(['red'])]]) });
    expect(productMatchesConditions(conditions, onlyColorMatches)).toBe(false);
  });

  it('MULTISELECT-style multi-value attribute: matches if ANY selected value is allowed', () => {
    const conditions = [attribute(7n, 'wool')];
    const context1 = context({ attributeValues: new Map([['7', new Set(['cotton', 'wool'])]]) });
    expect(productMatchesConditions(conditions, context1)).toBe(true);
  });

  it('PRODUCT and CATEGORY and ATTRIBUTE groups all AND together when combined on one coupon', () => {
    const conditions = [product(1n), category(10n), attribute(5n, 'red')];
    const full = context({ productId: 1n, categoryIds: new Set([10n]), attributeValues: new Map([['5', new Set(['red'])]]) });
    expect(productMatchesConditions(conditions, full)).toBe(true);

    // Missing just the category match is enough to fail the whole thing (AND across groups).
    const missingCategory = context({ productId: 1n, categoryIds: new Set([99n]), attributeValues: new Map([['5', new Set(['red'])]]) });
    expect(productMatchesConditions(conditions, missingCategory)).toBe(false);
  });
});
