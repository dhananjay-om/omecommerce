'use client';

import { useActionState, useState } from 'react';
import { createCoupon, type ActionState } from './actions';
import type { CouponDiscountType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const DISCOUNT_TYPES: CouponDiscountType[] = ['PERCENTAGE', 'FIXED_AMOUNT'];

const initialState: ActionState = { error: null, success: false };

export function NewCouponDialog() {
  const [open, setOpen] = useState(false);
  const [discountType, setDiscountType] = useState<CouponDiscountType>('PERCENTAGE');
  const [state, formAction, pending] = useActionState(createCoupon, initialState);
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
        if (!next) setDiscountType('PERCENTAGE');
      }}
    >
      <DialogTrigger render={<Button>New Coupon</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Coupon</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpn-code">Code</Label>
            <Input id="cpn-code" name="code" required placeholder="e.g. SAVE10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpn-description">Description</Label>
            <Input id="cpn-description" name="description" placeholder="Optional, admin-facing only" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpn-discountType">Discount Type</Label>
            <Select name="discountType" value={discountType} onValueChange={(v) => setDiscountType(v as CouponDiscountType)}>
              <SelectTrigger id="cpn-discountType" className="w-full">
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
            <Label htmlFor="cpn-value">{discountType === 'PERCENTAGE' ? 'Percent off (0-100)' : 'Amount off'}</Label>
            <Input id="cpn-value" name="value" required placeholder={discountType === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 5.00'} />
          </div>
          {discountType === 'FIXED_AMOUNT' ? (
            <div className="space-y-2">
              <Label htmlFor="cpn-currency">Currency</Label>
              <Input id="cpn-currency" name="currency" required maxLength={3} placeholder="e.g. INR" />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="cpn-minSubtotal">Minimum order subtotal</Label>
            <Input
              id="cpn-minSubtotal"
              name="minSubtotal"
              disabled={discountType !== 'FIXED_AMOUNT'}
              placeholder={discountType === 'FIXED_AMOUNT' ? 'Optional' : 'Only available for Fixed Amount coupons'}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpn-usageLimit">Usage limit</Label>
              <Input id="cpn-usageLimit" name="usageLimit" type="number" step="1" min="1" placeholder="Unlimited" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpn-usageLimitPerCustomer">Per customer</Label>
              <Input id="cpn-usageLimitPerCustomer" name="usageLimitPerCustomer" type="number" step="1" min="1" placeholder="Unlimited" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpn-startsAt">Starts</Label>
              <Input id="cpn-startsAt" name="startsAt" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpn-endsAt">Ends</Label>
              <Input id="cpn-endsAt" name="endsAt" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpn-isActive">Status</Label>
            <Select name="isActive" defaultValue="true">
              <SelectTrigger id="cpn-isActive" className="w-full">
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
              {pending ? 'Creating…' : 'Create Coupon'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
