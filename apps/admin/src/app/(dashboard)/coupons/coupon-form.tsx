'use client';

import { useActionState, useState } from 'react';
import { createCoupon, updateCoupon, type ActionState } from './actions';
import type { Attribute, Category, Coupon, CouponDiscountType, CouponTargetType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionBuilder, conditionRowsFromView } from './condition-builder';

const DISCOUNT_TYPES: CouponDiscountType[] = ['PERCENTAGE', 'FIXED_AMOUNT'];

const initialState: ActionState = { error: null, success: false };

/** ISO datetime -> "YYYY-MM-DD" for <input type="date">'s defaultValue. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">{children}</CardContent>
    </Card>
  );
}

/** A full page, not a dialog — the condition builder's repeatable rows need real
 *  room to breathe, and cramming Product/Category/Attribute pickers into a modal
 *  made the whole form feel squeezed. Same "dedicated page" pattern products/new
 *  and products/[id] already use, not a one-off. Shared by both /coupons/new and
 *  /coupons/[code]/edit — `coupon` present means edit mode. */
export function CouponForm({
  coupon,
  attributes,
  categories,
}: {
  coupon?: Coupon;
  attributes: Attribute[];
  categories: Category[];
}) {
  const isEdit = !!coupon;
  const [discountType, setDiscountType] = useState<CouponDiscountType>(coupon?.discountType ?? 'PERCENTAGE');
  const [targetType, setTargetType] = useState<CouponTargetType>(coupon?.targetType ?? 'CART');
  const action = isEdit ? updateCoupon : createCoupon;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {isEdit ? <input type="hidden" name="code" value={coupon.code} /> : null}

      <SectionCard title="Basic Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cpn-code">Code</Label>
            {isEdit ? (
              <p className="flex h-9 items-center text-sm font-medium">{coupon.code} <span className="ml-2 text-xs font-normal text-muted-foreground">(can&apos;t be changed)</span></p>
            ) : (
              <Input id="cpn-code" name="code" required placeholder="e.g. SAVE10" />
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cpn-description">Description</Label>
            <Input id="cpn-description" name="description" placeholder="Optional, admin-facing only" defaultValue={coupon?.description ?? ''} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Discount">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cpn-discountType">Discount Type</Label>
            <Select name="discountType" value={discountType} onValueChange={(v) => setDiscountType(v as CouponDiscountType)}>
              <SelectTrigger id="cpn-discountType" className="w-full">
                <SelectValue>{(value: CouponDiscountType) => (value === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpn-value">{discountType === 'PERCENTAGE' ? 'Percent off (0-100)' : 'Amount off'}</Label>
            <Input
              id="cpn-value"
              name="value"
              required
              defaultValue={coupon?.value}
              placeholder={discountType === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 5.00'}
            />
          </div>
          {discountType === 'FIXED_AMOUNT' ? (
            <div className="space-y-2">
              <Label htmlFor="cpn-currency">Currency</Label>
              <Input id="cpn-currency" name="currency" required maxLength={3} defaultValue={coupon?.currency ?? ''} placeholder="e.g. INR" />
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpn-minSubtotal">Minimum order subtotal</Label>
          <Input
            id="cpn-minSubtotal"
            name="minSubtotal"
            disabled={discountType !== 'FIXED_AMOUNT'}
            defaultValue={coupon?.minSubtotal ?? ''}
            placeholder={discountType === 'FIXED_AMOUNT' ? 'Optional' : 'Only available for Fixed Amount coupons'}
            className="max-w-xs"
          />
        </div>
      </SectionCard>

      <SectionCard title="Targeting">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cpn-targetType">Applies to</Label>
            <Select name="targetType" value={targetType} onValueChange={(v) => setTargetType(v as CouponTargetType)}>
              <SelectTrigger id="cpn-targetType" className="w-full">
                <SelectValue>{(value: CouponTargetType) => (value === 'CART' ? 'Whole Cart' : 'Specific Items')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CART">Whole Cart</SelectItem>
                <SelectItem value="ITEM">Specific Items</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpn-isAutoApply">Auto-Apply</Label>
            <Select name="isAutoApply" defaultValue={coupon?.isAutoApply ? 'true' : 'false'}>
              <SelectTrigger id="cpn-isAutoApply" className="w-full">
                <SelectValue>{(value: string) => (value === 'true' ? 'Applies automatically' : 'Requires a code')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Requires a code</SelectItem>
                <SelectItem value="true">Applies automatically</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {targetType === 'ITEM' ? (
          <ConditionBuilder
            attributes={attributes}
            categories={categories}
            initialRows={coupon && targetType === coupon.targetType ? conditionRowsFromView(coupon.conditions) : undefined}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Usage & Schedule">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cpn-usageLimit">Usage limit</Label>
            <Input id="cpn-usageLimit" name="usageLimit" type="number" step="1" min="1" defaultValue={coupon?.usageLimit ?? ''} placeholder="Unlimited" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpn-usageLimitPerCustomer">Per customer</Label>
            <Input
              id="cpn-usageLimitPerCustomer"
              name="usageLimitPerCustomer"
              type="number"
              step="1"
              min="1"
              defaultValue={coupon?.usageLimitPerCustomer ?? ''}
              placeholder="Unlimited"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpn-startsAt">Starts</Label>
            <Input id="cpn-startsAt" name="startsAt" type="date" defaultValue={toDateInputValue(coupon?.startsAt ?? null)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpn-endsAt">Ends</Label>
            <Input id="cpn-endsAt" name="endsAt" type="date" defaultValue={toDateInputValue(coupon?.endsAt ?? null)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Status">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="cpn-isActive">Status</Label>
          <Select name="isActive" defaultValue={coupon ? (coupon.isActive ? 'true' : 'false') : 'true'}>
            <SelectTrigger id="cpn-isActive" className="w-full">
              <SelectValue>{(value: string) => (value === 'true' ? 'Active' : 'Inactive')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Coupon'}
      </Button>
    </form>
  );
}
