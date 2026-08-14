import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import type { Attribute, Category, Coupon } from '@/lib/types';
import { CouponForm } from '../../coupon-form';

export default async function EditCouponPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // No standalone GET /admin/v1/coupons/:code — the list is small (admin-authored
  // config, not customer data), so filtering the list is simpler than adding a
  // new endpoint just for this page.
  const [coupons, attributes, categories] = await Promise.all([
    apiGet<Coupon[]>('/admin/v1/coupons'),
    apiGet<Attribute[]>('/admin/v1/attributes'),
    apiGet<Category[]>('/admin/v1/categories'),
  ]);
  const coupon = coupons.find((c) => c.code === code.toUpperCase());
  if (!coupon) notFound();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Coupon — {coupon.code}</h1>
      <div className="mt-6">
        <CouponForm coupon={coupon} attributes={attributes} categories={categories} />
      </div>
    </div>
  );
}
