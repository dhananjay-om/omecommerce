import type { Metadata } from 'next';
import { ensureCart } from '@/lib/cart-server';
import { CartPageClient } from '@/components/cart/cart-page-client';

export const metadata: Metadata = { title: 'Your Cart' };

/** Server-rendered for a fast first paint (real cart data before any client JS runs); CartPageClient seeds the shared cartStore from it so the header badge/mini-cart stay in sync without a redundant fetch. */
export default async function CartPage() {
  const cart = await ensureCart();
  return <CartPageClient initialCart={cart} />;
}
