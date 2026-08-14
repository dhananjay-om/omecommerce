'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { completeCheckout } from '@/services/checkout.service';
import { useCartStore, countItems } from '@/store/cart-store';
import { CheckoutSteps } from './checkout-steps';
import { AddressFields } from './address-fields';
import { checkoutSchema, STEP_FIELDS, type CheckoutFormValues } from './checkout-schema';
import { formatPrice } from '@/lib/format-price';
import { CouponField } from '@/components/cart/coupon-field';
import type { Cart } from '@/types/cart';
import type { ShippingMethod } from '@/types/order';

const TOTAL_STEPS = 5;

export function CheckoutPageClient({ cart, shippingMethods }: { cart: Cart; shippingMethods: ShippingMethod[] }) {
  const router = useRouter();
  const hydrateCart = useCartStore((s) => s.hydrate);
  const storeCart = useCartStore((s) => s.cart);
  const hydrated = useCartStore((s) => s.hydrated);
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: '',
      shippingAddress: { name: '', line1: '', line2: '', city: '', region: '', postalCode: '', country: '', phone: '' },
      sameAsShipping: true,
      billingAddress: { name: '', line1: '', line2: '', city: '', region: '', postalCode: '', country: '', phone: '' },
      shippingMethodCode: shippingMethods[0]?.code ?? '',
      paymentMethod: 'test_card',
      testScenario: 'approve',
    },
  });

  useEffect(() => {
    if (!hydrated) {
      useCartStore.setState({ cart, itemCount: countItems(cart), hydrated: true });
    }
    // Seed once from the server-rendered cart prop; afterwards the store is the
    // single source of truth (same pattern as CartPageClient) — needed so
    // CouponField's apply/remove actions are reflected here too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const displayCart = storeCart ?? cart;

  const sameAsShipping = watch('sameAsShipping');
  const selectedShippingMethodCode = watch('shippingMethodCode');
  const selectedShippingMethod = shippingMethods.find((m) => m.code === selectedShippingMethodCode);

  async function goNext() {
    // Step 2's billing fields are only required (and only rendered) when
    // "same as shipping" is unchecked — validating them while hidden would
    // block advancing on fields the user was never shown.
    const fields = step === 2 && sameAsShipping ? [] : (STEP_FIELDS[step] ?? []);
    const valid = fields.length === 0 || (await trigger(fields as (keyof CheckoutFormValues)[]));
    if (valid) setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const shippingAddress = { ...values.shippingAddress, country: values.shippingAddress.country.toUpperCase() };
      const billingAddress = values.sameAsShipping
        ? shippingAddress
        : {
            name: values.billingAddress.name ?? '',
            line1: values.billingAddress.line1 ?? '',
            line2: values.billingAddress.line2,
            city: values.billingAddress.city ?? '',
            region: values.billingAddress.region,
            postalCode: values.billingAddress.postalCode ?? '',
            country: (values.billingAddress.country ?? '').toUpperCase(),
            phone: values.billingAddress.phone,
          };
      const order = await completeCheckout({
        email: values.email,
        shippingAddress,
        billingAddress,
        shippingMethodCode: values.shippingMethodCode,
        paymentMethod: values.paymentMethod,
        testScenario: values.testScenario,
      });
      hydrateCart(); // cart is now CONVERTED server-side; re-hydrate so the header badge reflects a fresh empty cart
      router.push(`/checkout/success/${order.publicId}`);
    } catch (err) {
      const message = isAxiosError(err) ? (err.response?.data?.error ?? 'Checkout failed. Please try again.') : 'Checkout failed. Please try again.';
      setSubmitError(message);
    }
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Checkout</h1>
      <CheckoutSteps current={step} />

      <div className="flex flex-col gap-8 lg:flex-row">
        <form onSubmit={onSubmit} className="flex-1 rounded-lg border p-6">
          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">Shipping</h2>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
              </div>
              <AddressFields prefix="shippingAddress" register={register} errors={errors} />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">Billing</h2>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={sameAsShipping} onCheckedChange={(checked) => setValue('sameAsShipping', checked === true)} />
                Same as shipping address
              </label>
              {!sameAsShipping ? <AddressFields prefix="billingAddress" register={register} errors={errors} /> : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">Delivery</h2>
              {shippingMethods.length === 0 ? (
                <p className="text-sm text-destructive">No shipping methods are configured.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {shippingMethods.map((method) => (
                    <label key={method.code} className="flex cursor-pointer items-center justify-between rounded-lg border p-3 has-[:checked]:border-primary">
                      <span className="flex items-center gap-2">
                        <input type="radio" value={method.code} {...register('shippingMethodCode')} />
                        {method.name}
                      </span>
                      <span className="font-medium">{formatPrice(method.flatRate, method.currency)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">Payment</h2>
              <p className="text-sm text-muted-foreground">
                This store uses a test payment gateway — no real card is charged. Card details aren&apos;t collected.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="paymentMethod">Payment method</Label>
                <select id="paymentMethod" {...register('paymentMethod')} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  <option value="test_card">Credit Card (test)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="testScenario">Simulate result (test gateway only)</Label>
                <select id="testScenario" {...register('testScenario')} className="h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  <option value="approve">Approve payment</option>
                  <option value="decline">Decline payment</option>
                </select>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">Review</h2>
              <div className="flex flex-col gap-1 text-sm">
                {displayCart.lines.map((line) => (
                  <div key={line.id} className="flex justify-between">
                    <span>
                      {line.name} &times; {line.qty}
                    </span>
                    <span>
                      {line.lineTotal ? formatPrice(line.lineTotal, displayCart.currency) : '—'}
                      {line.discountAmount && Number(line.discountAmount) > 0 ? (
                        <span className="ml-1 text-success">(-{formatPrice(line.discountAmount, displayCart.currency)})</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 text-sm">
                <p className="font-medium">Ship to</p>
                <p className="text-muted-foreground">{watch('shippingAddress.line1')}, {watch('shippingAddress.city')}</p>
              </div>
              <div className="text-sm">
                <p className="font-medium">Delivery</p>
                <p className="text-muted-foreground">{selectedShippingMethod?.name ?? '—'}</p>
              </div>
              {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
            </div>
          ) : null}

          {/* key={step} forces a fresh DOM node per step — without it, React can
              reuse the same button element across the Continue -> Place Order
              swap, and a click queued right at the transition boundary can land
              on the wrong (just-swapped-in) button type/handler. */}
          <div key={step} className="mt-6 flex justify-between">
            <Button type="button" variant="ghost" onClick={goBack} disabled={step === 1}>
              Back
            </Button>
            {step < TOTAL_STEPS ? (
              <Button type="button" variant="cta" onClick={goNext}>
                Continue
              </Button>
            ) : (
              <Button type="submit" variant="cta" disabled={isSubmitting}>
                {isSubmitting ? 'Placing Order...' : 'Place Order'}
              </Button>
            )}
          </div>
        </form>

        <div className="flex w-full flex-col gap-3 rounded-lg border p-5 lg:w-80">
          <h2 className="font-semibold">Order Summary</h2>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{displayCart.subtotal ? formatPrice(displayCart.subtotal, displayCart.currency) : '—'}</span>
            </div>
            {displayCart.discountTotal ? (
              <div className="flex justify-between text-success">
                <span>Discount{displayCart.couponCode ? ` (${displayCart.couponCode})` : ''}</span>
                <span>-{formatPrice(displayCart.discountTotal, displayCart.currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{selectedShippingMethod ? formatPrice(selectedShippingMethod.flatRate, selectedShippingMethod.currency) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-muted-foreground">Calculated at order placement</span>
            </div>
          </div>
          <CouponField cart={displayCart} />
        </div>
      </div>
    </div>
  );
}
