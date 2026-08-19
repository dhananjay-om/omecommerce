import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ensureCart } from '@/lib/cart-server';
import { getSession } from '@/lib/session';
import { ApiError } from '@/lib/api-client';
import { listShippingMethods } from '@/services/order.service';
import { getMyCompanyCredit } from '@/services/company.service';
import { getMyAddresses } from '@/services/address.service';
import { CheckoutPageClient } from '@/components/checkout/checkout-page-client';
import type { MyCompanyCredit } from '@/types/company';
import type { CustomerAddress } from '@/types/customer';

export const metadata: Metadata = { title: 'Checkout' };

/**
 * getSession() only proves a session COOKIE exists, not that the token is
 * still valid — checkout (unlike /account/*) isn't gated behind
 * requireSession(), so a stale/expired cookie reaches here routinely. The
 * backend's own doc comment on session.ts promises that case "fails 401s
 * gracefully" — this call must honor that, not crash the whole checkout page
 * over a "nice to have" credit-line preview or address-book prefill.
 */
async function loadForSignedInShopper<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  if (!(await getSession())) return fallback;
  try {
    return await loader();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return fallback;
    throw err;
  }
}

export default async function CheckoutPage() {
  const cart = await ensureCart();
  if (cart.lines.length === 0) redirect('/cart');

  // Guest checkout is fully supported (plan/00), so both of these are only
  // ever fetched for a signed-in shopper — a guest can't belong to a B2B
  // company, and there's no address book without an account.
  const [shippingMethods, myCredit, savedAddresses] = await Promise.all([
    listShippingMethods(cart.currency),
    loadForSignedInShopper<MyCompanyCredit | null>(getMyCompanyCredit, null),
    loadForSignedInShopper<CustomerAddress[]>(getMyAddresses, []),
  ]);

  return (
    <CheckoutPageClient
      cart={cart}
      shippingMethods={shippingMethods}
      myCredit={myCredit}
      savedAddresses={savedAddresses}
    />
  );
}
