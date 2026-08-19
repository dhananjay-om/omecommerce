import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ensureCart } from '@/lib/cart-server';
import { getSession } from '@/lib/session';
import { listShippingMethods } from '@/services/order.service';
import { getMyCompanyCredit } from '@/services/company.service';
import { CheckoutPageClient } from '@/components/checkout/checkout-page-client';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const cart = await ensureCart();
  if (cart.lines.length === 0) redirect('/cart');

  // Guest checkout is fully supported (plan/00), so "pay on account" is only
  // ever fetched for a signed-in shopper — a guest can't belong to a B2B
  // company in the first place, and /me/company/credit requires a session.
  const [shippingMethods, myCredit] = await Promise.all([
    listShippingMethods(cart.currency),
    (await getSession()) ? getMyCompanyCredit() : Promise.resolve(null),
  ]);

  return <CheckoutPageClient cart={cart} shippingMethods={shippingMethods} myCredit={myCredit} />;
}
