import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ensureCart } from '@/lib/cart-server';
import { apiGet } from '@/lib/api-client';
import { loadForSignedInShopper } from '@/lib/load-for-signed-in-shopper';
import { listShippingMethods } from '@/services/order.service';
import { getMyCompanyCredit } from '@/services/company.service';
import { getMyAddresses } from '@/services/address.service';
import { getMyWallet } from '@/services/wallet.service';
import { CheckoutPageClient } from '@/components/checkout/checkout-page-client';
import type { MyCompanyCredit } from '@/types/company';
import type { CustomerAddress, Customer } from '@/types/customer';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const cart = await ensureCart();
  if (cart.lines.length === 0) redirect('/cart');

  // Guest checkout is fully supported (plan/00), so all four of these are
  // only ever fetched for a signed-in shopper — a guest can't belong to a
  // B2B company, has no address book, no account email to prefill, and no
  // wallet.
  const [shippingMethods, myCredit, savedAddresses, customerEmail, walletBalance] =
    await Promise.all([
      listShippingMethods(cart.currency),
      loadForSignedInShopper<MyCompanyCredit | null>(getMyCompanyCredit, null),
      loadForSignedInShopper<CustomerAddress[]>(getMyAddresses, []),
      loadForSignedInShopper<string | null>(
        async () => (await apiGet<Customer>('/store/v1/me', { auth: true })).email,
        null,
      ),
      loadForSignedInShopper<string | null>(async () => (await getMyWallet()).balance, null),
    ]);

  return (
    <CheckoutPageClient
      cart={cart}
      shippingMethods={shippingMethods}
      myCredit={myCredit}
      savedAddresses={savedAddresses}
      customerEmail={customerEmail}
      walletBalance={walletBalance}
    />
  );
}
