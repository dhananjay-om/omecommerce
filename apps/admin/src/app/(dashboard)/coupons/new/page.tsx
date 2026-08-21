import { apiGet } from '@/lib/api-client';
import type { Attribute, Category } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { CouponForm } from '../coupon-form';

export default async function NewCouponPage() {
  const [attributes, categories] = await Promise.all([
    apiGet<Attribute[]>('/admin/v1/attributes'),
    apiGet<Category[]>('/admin/v1/categories'),
  ]);

  return (
    <div>
      <BackLink href="/coupons" label="Back to Coupons" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">New Coupon</h1>
      <div className="mt-6">
        <CouponForm attributes={attributes} categories={categories} />
      </div>
    </div>
  );
}
