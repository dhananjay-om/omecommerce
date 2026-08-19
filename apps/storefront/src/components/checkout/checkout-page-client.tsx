'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
import {
  checkoutSchema,
  STEP_FIELDS,
  BILLING_ADDRESS_FIELDS,
  type CheckoutFormValues,
} from './checkout-schema';
import { formatPrice } from '@/lib/format-price';
import { TaxInclusiveNote } from '@/components/tax-inclusive-note';
import { CouponField } from '@/components/cart/coupon-field';
import { GiftCardField } from '@/components/cart/gift-card-field';
import { WalletToggle } from '@/components/cart/wallet-toggle';
import { CreditTermsToggle } from '@/components/cart/credit-terms-toggle';
import type { Cart } from '@/types/cart';
import type { ShippingMethod } from '@/types/order';
import type { MyCompanyCredit } from '@/types/company';
import type { CustomerAddress } from '@/types/customer';

const TOTAL_STEPS = 3;

/**
 * A real radio group (not plain clickable cards) above the shipping/billing
 * address form for a signed-in shopper's saved address book (plan/16) — the
 * selected card gets a visible checked state, matching the shipping-method
 * step's own radio-card pattern. Selecting a card fills the form below via
 * setValue rather than replacing the form entirely, so a shopper can still
 * tweak a field (or type a brand new address by leaving the group
 * unselected) without losing the form altogether. Saved addresses carry no
 * stateCode/gstin (those are checkout-only fields — see AddressFields), so
 * picking one leaves whatever the shopper already typed there untouched
 * instead of clobbering it.
 *
 * "Add or edit addresses" deliberately opens /account/addresses in a NEW TAB
 * rather than navigating checkout away to it — this multi-step form's
 * progress (which step, unsubmitted field values) lives only in client
 * state, not the server-side cart, so a same-tab redirect would silently
 * lose it. The shopper finishes managing addresses in the other tab, then
 * comes back and re-opens this picker (Step back/forward re-fetches nothing,
 * so a newly added address won't appear without a page refresh — an
 * accepted, documented limitation, not a bug to chase).
 */
function SavedAddressPicker({
  addresses,
  groupName,
  selectedId,
  onSelect,
}: {
  addresses: CustomerAddress[];
  groupName: string;
  selectedId: string | null;
  onSelect: (address: CustomerAddress) => void;
}) {
  if (addresses.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Saved addresses</p>
        <Link
          href="/account/addresses"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-primary hover:underline"
        >
          Add or edit addresses
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {addresses.map((a) => (
          <label
            key={a.publicId}
            className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
          >
            <input
              type="radio"
              name={groupName}
              className="mt-1"
              checked={selectedId === a.publicId}
              onChange={() => onSelect(a)}
            />
            <span>
              <span className="block font-medium">{a.name}</span>
              <span className="block text-muted-foreground">
                {a.line1}, {a.city} {a.postalCode}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Or leave unselected and enter a different address below.
      </p>
    </div>
  );
}

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

export function CheckoutPageClient({
  cart,
  shippingMethods,
  myCredit,
  savedAddresses,
  customerEmail,
  walletBalance,
}: {
  cart: Cart;
  shippingMethods: ShippingMethod[];
  /** null covers every non-eligible shopper (guest, no company, no credit terms) — the "pay on account" option and PO field just don't render. */
  myCredit: MyCompanyCredit | null;
  /** Empty for a guest or a signed-in shopper with nothing saved yet — the picker just doesn't render (AddressFields' blank form still does). */
  savedAddresses: CustomerAddress[];
  /** null for a guest — the email field stays a plain editable input for them. A signed-in shopper's account email is already known, so it's shown read-only instead of asked for again. */
  customerEmail: string | null;
  /** null for a guest — WalletToggle just hides its balance caption. A signed-in shopper sees their real balance, including a genuine "₹0.00". */
  walletBalance: string | null;
}) {
  const creditAccount =
    myCredit?.account &&
    myCredit.account.status === 'ACTIVE' &&
    Number(myCredit.account.available) > 0
      ? myCredit.account
      : null;
  const router = useRouter();
  const hydrateCart = useCartStore((s) => s.hydrate);
  const storeCart = useCartStore((s) => s.cart);
  const hydrated = useCartStore((s) => s.hydrated);
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedShippingAddressId, setSelectedShippingAddressId] = useState<string | null>(null);
  const [selectedBillingAddressId, setSelectedBillingAddressId] = useState<string | null>(null);
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
      email: customerEmail ?? '',
      shippingAddress: {
        name: '',
        line1: '',
        line2: '',
        city: '',
        region: '',
        stateCode: '',
        gstin: '',
        postalCode: '',
        country: '',
        phone: '',
      },
      sameAsShipping: true,
      billingAddress: {
        name: '',
        line1: '',
        line2: '',
        city: '',
        region: '',
        stateCode: '',
        gstin: '',
        postalCode: '',
        country: '',
        phone: '',
      },
      shippingMethodCode: shippingMethods[0]?.code ?? '',
      paymentMethod: 'test_card',
      testScenario: 'approve',
      poNumber: '',
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

  useEffect(() => {
    // Auto-select whichever saved address is marked default (set via
    // /account/addresses' "Set as default" checkboxes) — a shopper who's
    // already told us their default shouldn't have to pick it again every
    // checkout. Runs once on mount; savedAddresses is a server-fetched prop
    // that never changes for the life of this page.
    const defaultShipping = savedAddresses.find((a) => a.isDefaultShipping);
    if (defaultShipping) applySavedAddress('shippingAddress', defaultShipping);
    const defaultBilling = savedAddresses.find((a) => a.isDefaultBilling);
    if (defaultBilling) applySavedAddress('billingAddress', defaultBilling);
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
      ? Number(displayCart.estimatedTotal) +
        (selectedShippingMethod ? Number(selectedShippingMethod.flatRate) : 0)
      : null;
  // Same shipping-inclusive adjustment as estimatedGrandTotal above, applied
  // to amountDue (which — like estimatedTotal — is computed pre-shipping,
  // the only total known before a shipping method is picked).
  const estimatedAmountDue =
    displayCart.amountDue !== null
      ? Number(displayCart.amountDue) +
        (selectedShippingMethod ? Number(selectedShippingMethod.flatRate) : 0)
      : null;

  async function goNext() {
    // Billing address fields are only required (and only rendered) when
    // "same as shipping" is unchecked on step 1 — validating them while
    // hidden would block advancing on fields the user was never shown.
    const fields = [
      ...(STEP_FIELDS[step] ?? []),
      ...(step === 1 && !sameAsShipping ? BILLING_ADDRESS_FIELDS : []),
    ];
    const valid = fields.length === 0 || (await trigger(fields as (keyof CheckoutFormValues)[]));
    if (valid) setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function applySavedAddress(
    prefix: 'shippingAddress' | 'billingAddress',
    address: CustomerAddress,
  ) {
    (prefix === 'shippingAddress' ? setSelectedShippingAddressId : setSelectedBillingAddressId)(
      address.publicId,
    );
    setValue(`${prefix}.name`, address.name);
    setValue(`${prefix}.line1`, address.line1);
    setValue(`${prefix}.line2`, address.line2 ?? '');
    setValue(`${prefix}.city`, address.city);
    setValue(`${prefix}.region`, address.region ?? '');
    setValue(`${prefix}.postalCode`, address.postalCode);
    setValue(`${prefix}.country`, address.country);
    setValue(`${prefix}.phone`, address.phone ?? '');
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
        poNumber: blankToUndefined(values.poNumber),
      });
      hydrateCart(); // cart is now CONVERTED server-side; re-hydrate so the header badge reflects a fresh empty cart
      router.push(`/checkout/success/${order.publicId}`);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data?.error ?? 'Checkout failed. Please try again.')
        : 'Checkout failed. Please try again.';
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
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <h2 className="font-semibold">Shipping</h2>
                {customerEmail ? (
                  <p className="text-sm text-muted-foreground">
                    Order confirmation goes to{' '}
                    <span className="font-medium text-foreground">{customerEmail}</span>.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register('email')} />
                    {errors.email ? (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    ) : null}
                  </div>
                )}
                <SavedAddressPicker
                  addresses={savedAddresses}
                  groupName="saved-shipping-address"
                  selectedId={selectedShippingAddressId}
                  onSelect={(a) => applySavedAddress('shippingAddress', a)}
                />
                {selectedShippingAddressId ? (
                  <button
                    type="button"
                    onClick={() => setSelectedShippingAddressId(null)}
                    className="self-start text-xs font-medium text-primary hover:underline"
                  >
                    Enter a different address instead
                  </button>
                ) : (
                  <AddressFields prefix="shippingAddress" register={register} errors={errors} />
                )}
              </div>

              <div className="flex flex-col gap-4 border-t pt-6">
                <h2 className="font-semibold">Billing</h2>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={sameAsShipping}
                    onCheckedChange={(checked) => setValue('sameAsShipping', checked === true)}
                  />
                  Same as shipping address
                </label>
                {!sameAsShipping ? (
                  <>
                    <SavedAddressPicker
                      addresses={savedAddresses}
                      groupName="saved-billing-address"
                      selectedId={selectedBillingAddressId}
                      onSelect={(a) => applySavedAddress('billingAddress', a)}
                    />
                    {selectedBillingAddressId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedBillingAddressId(null)}
                        className="self-start text-xs font-medium text-primary hover:underline"
                      >
                        Enter a different address instead
                      </button>
                    ) : (
                      <AddressFields prefix="billingAddress" register={register} errors={errors} />
                    )}
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">Delivery</h2>
              {shippingMethods.length === 0 ? (
                <p className="text-sm text-destructive">No shipping methods are configured.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {shippingMethods.map((method) => (
                    <label
                      key={method.code}
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-3 has-[:checked]:border-primary"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          value={method.code}
                          {...register('shippingMethodCode')}
                        />
                        {method.name}
                      </span>
                      <span className="font-medium">
                        {formatPrice(method.flatRate, method.currency)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <h2 className="font-semibold">Payment</h2>
                {estimatedAmountDue !== null && estimatedAmountDue <= 0 ? (
                  <p className="text-sm text-success">
                    Your wallet/gift card tenders cover the full total — no card payment is needed.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This store uses a test payment gateway — no real card is charged. Card details
                    aren&apos;t collected.
                  </p>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="paymentMethod">Payment method</Label>
                  <select
                    id="paymentMethod"
                    {...register('paymentMethod')}
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    <option value="test_card">Credit Card (test)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="testScenario">Simulate result (test gateway only)</Label>
                  <select
                    id="testScenario"
                    {...register('testScenario')}
                    className="h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    <option value="approve">Approve payment</option>
                    <option value="decline">Decline payment</option>
                  </select>
                </div>
                {creditAccount ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="poNumber">PO number (optional)</Label>
                    <Input id="poNumber" placeholder="e.g. PO-10294" {...register('poNumber')} />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 border-t pt-6">
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
                          <span className="ml-1 text-success">
                            (-{formatPrice(line.discountAmount, displayCart.currency)})
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <p className="font-medium">Ship to</p>
                  <p className="text-muted-foreground">
                    {watch('shippingAddress.line1')}, {watch('shippingAddress.city')}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">Delivery</p>
                  <p className="text-muted-foreground">{selectedShippingMethod?.name ?? '—'}</p>
                </div>
                {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
              </div>
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
                {displayCart.subtotal
                  ? formatPrice(displayCart.subtotal, displayCart.currency)
                  : '—'}
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
              <span>
                {selectedShippingMethod
                  ? formatPrice(selectedShippingMethod.flatRate, selectedShippingMethod.currency)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Tax{!displayCart.pricesIncludeTax && displayCart.taxTotal ? ' (estimated)' : ''}
              </span>
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
              <span>
                {estimatedGrandTotal !== null
                  ? formatPrice(estimatedGrandTotal, displayCart.currency)
                  : '—'}
              </span>
            </div>
          </div>
          <CouponField cart={displayCart} />
          <GiftCardField cart={displayCart} />
          <WalletToggle cart={displayCart} walletBalance={walletBalance} />
          {creditAccount ? <CreditTermsToggle cart={displayCart} account={creditAccount} /> : null}
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
