import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ensureCart } from '@/lib/cart-server';
import { listShippingMethods } from '@/services/order.service';
import { CheckoutPageClient } from '@/components/checkout/checkout-page-client';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const cart = await ensureCart();
  if (cart.lines.length === 0) redirect('/cart');

  const shippingMethods = await listShippingMethods(cart.currency);

  return <CheckoutPageClient cart={cart} shippingMethods={shippingMethods} />;
}
