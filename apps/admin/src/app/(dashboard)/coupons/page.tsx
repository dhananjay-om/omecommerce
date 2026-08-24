import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import type { Coupon } from '@/lib/types';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { CouponsTable } from './coupons-table';

export default async function CouponsPage() {
  const coupons = await apiGet<Coupon[]>('/admin/v1/coupons');
  const activeCount = coupons.filter((c) => c.isActive).length;

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/coupons' }, { label: 'Discounts' }]} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Discounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} active promotion{activeCount === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/coupons/new" className={cn(buttonVariants({ size: 'sm' }))}>
          <Plus className="size-3.5" />
          Create Discount
        </Link>
      </div>

      <div className="mt-6">
        <CouponsTable coupons={coupons} />
      </div>
    </div>
  );
}
