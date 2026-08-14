import type { CouponDiscountType, CouponTargetType, CouponConditionType } from '../domain/repositories.js';

/** Admin-submitted condition shape — references PRODUCT/CATEGORY by publicId and
 *  ATTRIBUTE by code, matching every other admin-facing reference in this codebase
 *  (see set-product-categories.usecase.ts's identical publicId resolve-loop). Resolved
 *  to internal bigint ids by CreateCoupon/UpdateCoupon before hitting the repository. */
export interface CouponConditionCommand {
  conditionType: CouponConditionType;
  /** Required iff conditionType='PRODUCT'. */
  productId?: string;
  /** Required iff conditionType='CATEGORY'. */
  categoryId?: string;
  /** Required iff conditionType='ATTRIBUTE', alongside attributeValue. */
  attributeCode?: string;
  /** Required iff conditionType='ATTRIBUTE' — an AttributeOption id (as a string)
   *  for SELECT/MULTISELECT attributes, or the raw scalar text otherwise. */
  attributeValue?: string;
}

export interface CreateCouponCommand {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  value: string;
  currency?: string | null;
  minSubtotal?: string | null;
  targetType?: CouponTargetType;
  isAutoApply?: boolean;
  conditions?: CouponConditionCommand[];
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export interface UpdateCouponCommand {
  code: string;
  description?: string | null;
  discountType?: CouponDiscountType;
  value?: string;
  currency?: string | null;
  minSubtotal?: string | null;
  targetType?: CouponTargetType;
  isAutoApply?: boolean;
  conditions?: CouponConditionCommand[];
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

/** Display-friendly readback of one condition row — publicId/code/label resolved
 *  back from the internal ids CouponCondition actually stores, so the admin UI
 *  never has to separately re-fetch "what product/category/attribute is #123". */
export interface CouponConditionView {
  conditionType: CouponConditionType;
  productId: string | null;
  productName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  attributeCode: string | null;
  attributeLabel: string | null;
  /** Raw stored value — an AttributeOption id for SELECT/MULTISELECT, or scalar text otherwise. */
  attributeValue: string | null;
  /** Resolved option label when attributeValue is an AttributeOption id; null otherwise. */
  attributeValueLabel: string | null;
}

export interface CouponView {
  publicId: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  value: string;
  currency: string | null;
  minSubtotal: string | null;
  targetType: CouponTargetType;
  isAutoApply: boolean;
  conditions: CouponConditionView[];
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}
