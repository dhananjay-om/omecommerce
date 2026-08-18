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
import { TaxInclusiveNote } from '@/components/tax-inclusive-note';
import { CouponField } from '@/components/cart/coupon-field';
import { GiftCardField } from '@/components/cart/gift-card-field';
import { WalletToggle } from '@/components/cart/wallet-toggle';
import type { Cart } from '@/types/cart';
import type { ShippingMethod } from '@/types/order';

const TOTAL_STEPS = 5;

/** An untouched optional field is '' (react-hook-form's default), and a stray
 *  space (accidental keystroke, browser autofill) is just as blank in intent
 *  — neither is a real value the backend's format regex would ever match, so
 *  both must become "not sent," not a hard validation failure. The backend
 *  schema normalizes the same way independently — this just avoids a round
 *  trip for the common case. */
function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

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
      shippingAddress: { name: '', line1: '', line2: '', city: '', region: '', stateCode: '', gstin: '', postalCode: '', country: '', phone: '' },
      sameAsShipping: true,
      billingAddress: { name: '', line1: '', line2: '', city: '', region: '', stateCode: '', gstin: '', postalCode: '', country: '', phone: '' },
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

  // Display-only preview — the authoritative total (exact bigint math, tax
  // finalized against the real shipping state) is computed server-side when
  // the order is actually placed; this just gives the customer an honest
  // number to check before they get there, same shape estimatedTotal already
  // has (subtotal - discount, + tax when exclusive), plus shipping once a
  // method is picked.
  const estimatedGrandTotal =
    displayCart.estimatedTotal !== null
      ? Number(displayCart.estimatedTotal) + (selectedShippingMethod ? Number(selectedShippingMethod.flatRate) : 0)
      : null;
  // Same shipping-inclusive adjustment as estimatedGrandTotal above, applied
  // to amountDue (which — like estimatedTotal — is computed pre-shipping,
  // the only total known before a shipping method is picked).
  const estimatedAmountDue = displayCart.amountDue !== null ? Number(displayCart.amountDue) + (selectedShippingMethod ? Number(selectedShippingMethod.flatRate) : 0) : null;

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
      // stateCode/gstin are optional but format-validated server-side (2-digit
      // code / real GSTIN pattern) — an untouched form field is '' (react-hook-form's
      // default), which fails that regex, so a blank must become undefined, not ''.
      const shippingAddress = {
        ...values.shippingAddress,
        country: values.shippingAddress.country.toUpperCase(),
        stateCode: blankToUndefined(values.shippingAddress.stateCode),
        gstin: blankToUndefined(values.shippingAddress.gstin),
      };
      const billingAddress = values.sameAsShipping
        ? shippingAddress
        : {
            name: values.billingAddress.name ?? '',
            line1: values.billingAddress.line1 ?? '',
            line2: values.billingAddress.line2,
            city: values.billingAddress.city ?? '',
            region: values.billingAddress.region,
            stateCode: blankToUndefined(values.billingAddress.stateCode),
            gstin: blankToUndefined(values.billingAddress.gstin),
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
              {estimatedAmountDue !== null && estimatedAmountDue <= 0 ? (
                <p className="text-sm text-success">
                  Your wallet/gift card tenders cover the full total — no card payment is needed.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This store uses a test payment gateway — no real card is charged. Card details aren&apos;t collected.
                </p>
              )}
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
              <span>
                {displayCart.subtotal ? formatPrice(displayCart.subtotal, displayCart.currency) : '—'}
                {displayCart.subtotal && displayCart.pricesIncludeTax ? <TaxInclusiveNote /> : null}
              </span>
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
              <span className="text-muted-foreground">Tax{!displayCart.pricesIncludeTax && displayCart.taxTotal ? ' (estimated)' : ''}</span>
              <span className={displayCart.pricesIncludeTax ? 'text-muted-foreground' : undefined}>
                {displayCart.taxTotal
                  ? displayCart.pricesIncludeTax
                    ? `${formatPrice(displayCart.taxTotal, displayCart.currency)} included above`
                    : formatPrice(displayCart.taxTotal, displayCart.currency)
                  : displayCart.pricesIncludeTax
                    ? 'Included in prices above'
                    : 'Calculated at order placement'}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1.5 text-base font-bold">
              <span>Estimated Total</span>
              <span>{estimatedGrandTotal !== null ? formatPrice(estimatedGrandTotal, displayCart.currency) : '—'}</span>
            </div>
          </div>
          <CouponField cart={displayCart} />
          <GiftCardField cart={displayCart} />
          <WalletToggle cart={displayCart} />
          {displayCart.tenders.length > 0 && estimatedAmountDue !== null ? (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Amount due</span>
              <span>{formatPrice(estimatedAmountDue, displayCart.currency)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
