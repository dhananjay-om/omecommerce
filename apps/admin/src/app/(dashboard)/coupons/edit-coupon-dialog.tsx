'use client';

import { useActionState, useState } from 'react';
import { updateCoupon, type ActionState } from './actions';
import type { Attribute, Category, Coupon, CouponDiscountType, CouponTargetType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ConditionBuilder, conditionRowsFromView } from './condition-builder';

const DISCOUNT_TYPES: CouponDiscountType[] = ['PERCENTAGE', 'FIXED_AMOUNT'];

const initialState: ActionState = { error: null, success: false };

/** ISO datetime -> "YYYY-MM-DD" for <input type="date">'s defaultValue. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function EditCouponDialog({ coupon, attributes, categories }: { coupon: Coupon; attributes: Attribute[]; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [discountType, setDiscountType] = useState<CouponDiscountType>(coupon.discountType);
  const [targetType, setTargetType] = useState<CouponTargetType>(coupon.targetType);
  const [state, formAction, pending] = useActionState(updateCoupon, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDiscountType(coupon.discountType);
          setTargetType(coupon.targetType);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Coupon — {coupon.code}</DialogTitle>
          <DialogDescription>The code can&apos;t be changed after creation.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={coupon.code} />
          <div className="space-y-2">
            <Label htmlFor={`epn-description-${coupon.code}`}>Description</Label>
            <Input id={`epn-description-${coupon.code}`} name="description" defaultValue={coupon.description ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`epn-discountType-${coupon.code}`}>Discount Type</Label>
            <Select name="discountType" value={discountType} onValueChange={(v) => setDiscountType(v as CouponDiscountType)}>
              <SelectTrigger id={`epn-discountType-${coupon.code}`} className="w-full">
                <SelectValue />
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
            <Label htmlFor={`epn-value-${coupon.code}`}>{discountType === 'PERCENTAGE' ? 'Percent off (0-100)' : 'Amount off'}</Label>
            <Input id={`epn-value-${coupon.code}`} name="value" required defaultValue={coupon.value} />
          </div>
          {discountType === 'FIXED_AMOUNT' ? (
            <div className="space-y-2">
              <Label htmlFor={`epn-currency-${coupon.code}`}>Currency</Label>
              <Input id={`epn-currency-${coupon.code}`} name="currency" required maxLength={3} defaultValue={coupon.currency ?? ''} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`epn-minSubtotal-${coupon.code}`}>Minimum order subtotal</Label>
            <Input
              id={`epn-minSubtotal-${coupon.code}`}
              name="minSubtotal"
              disabled={discountType !== 'FIXED_AMOUNT'}
              defaultValue={coupon.minSubtotal ?? ''}
              placeholder={discountType === 'FIXED_AMOUNT' ? 'Optional' : 'Only available for Fixed Amount coupons'}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`epn-targetType-${coupon.code}`}>Applies to</Label>
              <Select name="targetType" value={targetType} onValueChange={(v) => setTargetType(v as CouponTargetType)}>
                <SelectTrigger id={`epn-targetType-${coupon.code}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CART">Whole Cart</SelectItem>
                  <SelectItem value="ITEM">Specific Items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`epn-isAutoApply-${coupon.code}`}>Auto-Apply</Label>
              <Select name="isAutoApply" defaultValue={coupon.isAutoApply ? 'true' : 'false'}>
                <SelectTrigger id={`epn-isAutoApply-${coupon.code}`} className="w-full">
                  <SelectValue />
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
              initialRows={targetType === coupon.targetType ? conditionRowsFromView(coupon.conditions) : undefined}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`epn-usageLimit-${coupon.code}`}>Usage limit</Label>
              <Input id={`epn-usageLimit-${coupon.code}`} name="usageLimit" type="number" step="1" min="1" defaultValue={coupon.usageLimit ?? ''} placeholder="Unlimited" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`epn-usageLimitPerCustomer-${coupon.code}`}>Per customer</Label>
              <Input
                id={`epn-usageLimitPerCustomer-${coupon.code}`}
                name="usageLimitPerCustomer"
                type="number"
                step="1"
                min="1"
                defaultValue={coupon.usageLimitPerCustomer ?? ''}
                placeholder="Unlimited"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`epn-startsAt-${coupon.code}`}>Starts</Label>
              <Input id={`epn-startsAt-${coupon.code}`} name="startsAt" type="date" defaultValue={toDateInputValue(coupon.startsAt)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`epn-endsAt-${coupon.code}`}>Ends</Label>
              <Input id={`epn-endsAt-${coupon.code}`} name="endsAt" type="date" defaultValue={toDateInputValue(coupon.endsAt)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`epn-active-${coupon.code}`}>Status</Label>
            <Select name="isActive" defaultValue={coupon.isActive ? 'true' : 'false'}>
              <SelectTrigger id={`epn-active-${coupon.code}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
