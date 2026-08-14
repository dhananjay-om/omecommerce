import type { CouponDiscountType } from '../domain/repositories.js';

export interface CreateCouponCommand {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  value: string;
  currency?: string | null;
  minSubtotal?: string | null;
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
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export interface CouponView {
  publicId: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  value: string;
  currency: string | null;
  minSubtotal: string | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}
