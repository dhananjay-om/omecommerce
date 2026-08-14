import type { CouponInfo, CouponConditionInfo, ProductLookup, CategoryLookup, AttributeLookup } from '../domain/repositories.js';
import type { CouponView, CouponConditionView } from './dto.js';

async function toConditionView(
  c: CouponConditionInfo,
  lookups: { products: ProductLookup; categories: CategoryLookup; attributes: AttributeLookup },
): Promise<CouponConditionView> {
  const view: CouponConditionView = {
    conditionType: c.conditionType,
    productId: null,
    productName: null,
    categoryId: null,
    categoryName: null,
    attributeCode: null,
    attributeLabel: null,
    attributeValue: c.attributeValue,
    attributeValueLabel: null,
  };
  if (c.conditionType === 'PRODUCT' && c.productId !== null) {
    const product = await lookups.products.byId(c.productId);
    view.productId = product?.publicId ?? null;
    view.productName = product?.name ?? null;
  } else if (c.conditionType === 'CATEGORY' && c.categoryId !== null) {
    const category = await lookups.categories.byId(c.categoryId);
    view.categoryId = category?.publicId ?? null;
    view.categoryName = category?.name ?? null;
  } else if (c.conditionType === 'ATTRIBUTE' && c.attributeId !== null) {
    const attribute = await lookups.attributes.byId(c.attributeId);
    view.attributeCode = attribute?.code ?? null;
    view.attributeLabel = attribute?.label ?? null;
    if (attribute && (attribute.dataType === 'SELECT' || attribute.dataType === 'MULTISELECT') && c.attributeValue) {
      view.attributeValueLabel = await lookups.attributes.optionLabel(BigInt(c.attributeValue));
    }
  }
  return view;
}

export async function toView(
  c: CouponInfo,
  lookups: { products: ProductLookup; categories: CategoryLookup; attributes: AttributeLookup },
): Promise<CouponView> {
  return {
    publicId: c.publicId,
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    value: c.value,
    currency: c.currency,
    minSubtotal: c.minSubtotal,
    targetType: c.targetType,
    isAutoApply: c.isAutoApply,
    conditions: await Promise.all(c.conditions.map((cond) => toConditionView(cond, lookups))),
    usageLimit: c.usageLimit,
    usageLimitPerCustomer: c.usageLimitPerCustomer,
    usageCount: c.usageCount,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
    isActive: c.isActive,
  };
}
